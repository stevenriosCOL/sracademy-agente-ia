const axios = require('axios');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

const SUPPORT_API_TIMEOUT_MS = 6000;
const SUPPORT_API_MAX_ATTEMPTS = 2;
const SUPPORT_API_BACKOFF_MS = 500;

const buildErrorResult = (status, error, requestId) => ({
  ok: false,
  status,
  error,
  request_id: requestId
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getSupportApiUrl = () => {
  if (!config.SUPPORT_API_URL) return null;
  return `${config.SUPPORT_API_URL.replace(/\/$/, '')}/v1/membership`;
};

const fetchUserStatus = async ({ param, value }) => {
  const requestId = global.crypto?.randomUUID?.() || require('crypto').randomUUID();
  const url = getSupportApiUrl();

  if (!config.SUPPORT_API_URL || !config.SUPPORT_API_KEY) {
    Logger.warn('⚠️ Support API no configurada', {
      status_code: 'config_missing',
      duration_ms: 0,
      request_id: requestId
    });
    return buildErrorResult('config_missing', 'config_missing', requestId);
  }

  for (let attempt = 1; attempt <= SUPPORT_API_MAX_ATTEMPTS; attempt += 1) {
    const startTime = Date.now();

    try {
      const response = await axios.get(url, {
        params: { [param]: value },
        headers: {
          'X-API-KEY': config.SUPPORT_API_KEY
        },
        timeout: SUPPORT_API_TIMEOUT_MS,
        validateStatus: () => true
      });

      const durationMs = Date.now() - startTime;
      Logger.info('📡 Support API response', {
        status_code: response.status,
        duration_ms: durationMs,
        request_id: requestId,
        attempt
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          ok: true,
          status: response.status,
          data: response.data,
          request_id: requestId
        };
      }

      if (response.status === 401) {
        return buildErrorResult(401, 'unauthorized', requestId);
      }

      if (response.status === 404) {
        return buildErrorResult(404, 'not_found', requestId);
      }

      if (response.status >= 500) {
        if (attempt < SUPPORT_API_MAX_ATTEMPTS) {
          await sleep(SUPPORT_API_BACKOFF_MS);
          continue;
        }
        return buildErrorResult(response.status, 'server_error', requestId);
      }

      return buildErrorResult(response.status, 'unexpected_status', requestId);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const status = error.response?.status || (error.code === 'ECONNABORTED' ? 'timeout' : 'network_error');
      Logger.warn('⚠️ Support API error', {
        status_code: status,
        duration_ms: durationMs,
        request_id: requestId,
        attempt
      });

      if (attempt >= SUPPORT_API_MAX_ATTEMPTS) {
        return buildErrorResult(status, 'request_failed', requestId);
      }

      await sleep(SUPPORT_API_BACKOFF_MS);
    }
  }

  return buildErrorResult('unknown', 'unknown', requestId);
};

module.exports = {
  fetchUserStatus
};