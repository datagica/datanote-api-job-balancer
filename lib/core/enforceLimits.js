'use strict'

// enforce the limits (this modify the original object, on purpose)
module.exports = function enforceLimits (params, apiLimits) {
  if (params) {
    if (params.types) {
      if (!Array.isArray(params.types)) {
        params.types = []
      }
      params.types = params.types.slice(0, apiLimits.maxTypes)
    }
  }
  return params
}
