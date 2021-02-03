// axios的二次封装
import axios from 'axios'
import Qs from 'qs'
import { addPending, removePending } from './cancelMap'
let count = 0
let loadingInstance = null

// create an axios instance
const service = axios.create({
  baseURL: '/api', // url = base url + request url
  // withCredentials: true, // send cookies when cross-domain requests
  // `transformResponse` 在传递给 then/catch 前，允许修改响应数据
  transformResponse: [
    function(data) {
      // 对 data 进行任意转换处理
      return data
    },
  ],
  // `paramsSerializer` 是一个负责 `params` 序列化的函数
  paramsSerializer: function(params) {
    return Qs.stringify(params, { arrayFormat: 'brackets' })
  },
  // `responseType` 表示服务器响应的数据类型，可以是 'arraybuffer', 'blob', 'document', 'json', 'text', 'stream'
  responseType: 'json', // 默认的
  // `xsrfCookieName` 是用作 xsrf token 的值的cookie的名称
  xsrfCookieName: 'XSRF-TOKEN', // default
  // `xsrfHeaderName` 是承载 xsrf token 的值的 HTTP 头的名称
  xsrfHeaderName: 'X-XSRF-TOKEN', // 默认的
  // `validateStatus` 定义对于给定的HTTP 响应状态码是 resolve 或 reject  promise 。如果 `validateStatus` 返回 `true` (或者设置为 `null` 或 `undefined`)，promise 将被 resolve; 否则，promise 将被 rejecte
  validateStatus: function(status) {
    return status >= 200 && status < 300 // 默认的
  },
})
// 请求拦截器
service.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    console.error('request:', error) // for debug
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code !== 200) {
      // 正常状态码200
      return Promise.reject(new Error(res.message || 'Error'))
    } else {
      return res
    }
  },
  (error) => {
    console.error('response:', error) // for debug
    const config = error.config
    // 不进行重试
    if (!config || !config._retry) return Promise.reject(error)
    // 设置重试初始值
    config.__retryCount = config.__retryCount || 0
    // 判断重试次数是否超出配置次数
    if (config.__retryCount >= config._retry) return Promise.reject(error)
    // 次数增加
    config.__retryCount += 1
    const backoff = new Promise(function(resolve) {
      setTimeout(function() {
        resolve()
      }, config._retryDelay || 1)
    })
    // Return the promise in which recalls axios to retry the request
    return backoff.then(function() {
      return service(config)
    })
  }
)
const transformRequest = function(data) {
  // 不使用axios里面的transformRequest，是因为它只处理了data，没有处理params，这里统一处理
  // 格式化参数
  return data
}
export function ajaxMixin(
  Vue,
  { mockServerUrl = 'https://www.easy-mock.com', mockServerId, router } = {}
) {
  axios.defaults.validateStatus = function(status) {
    return status >= 200 && status <= 204 // default
  }

  /**
   * 请求模块
   * @param {string} url 请求路径
   * @param {Object} data 请求参数对象
   * @param {Object} ext ext的其他参数，提供给axios的配置参数 https://github.com/axios/axios
   * @param {boolean} ext._ignoreMsg 是否忽略错误弹窗，改为自行捕获
   * @param {boolean} ext._loading 是否在请求时使用loading
   * @param {number} ext._mockServerId mock功能的id
   * @param {number} ext._mockServerUrl 在线mock的网站地址
   * @param {boolean} ext._mock 是否使用mock功能，默认不使用
   * @param {string} ext._type 把post put patch请求的数据包装成什么格式，默认json
   * @param {boolean} ext._retry 失败重试次数，默认0次
   * @param {boolean} ext._retryDelay 重试间隔时间，默认1s
   */
  const request = function(type) {
    return async function(url, data = {}, ext = { timeout: 30000, _retry: 0, _retryDelay: 1000 }) {
      const {
        _ignoreMsg = false,
        _loading = '正在加载...',
        _type = 'json',
        _mockServerId,
        _mockServerUrl,
        _mock,
        _confirm,
        ...options
      } = ext
      if (_confirm) {
        await this.$confirm(_confirm, '提示', {
          type: 'warning',
        })
      }
      const config = {}
      Object.assign(config, options)
      // 当设置_mock时当条请求使用mock数据
      config.url = _mock
        ? `${_mockServerUrl || mockServerUrl}/mock/${(_mockServerId ||
            mockServerId) + url}`
        : url
      config.method = type
      config.headers = config.headers || {}
      data = transformRequest(data) // 对请求参数的进行一些转化
      if (['put', 'post', 'patch'].includes(type)) {
        if (_type === 'form' && !(data instanceof FormData)) {
          const formData = new FormData()
          for (const [k, v] of Object.entries(data)) {
            formData.append(k, v)
          }
          config.data = formData
        } else {
          config.data = data
        }
      } else {
        config.params = data
      }
      try {
        loadingSwitch(this, _loading)
        removePending(config) // 在请求开始前，对之前的请求做检查取消操作
        addPending(config) // 将当前请求添加到 pending 中
        const { data } = await service(config)
        return data
      } catch (error) {
        if (error.code === 'ECONNABORTED') error.msg = '请求超时'
        if (!_ignoreMsg && !axios.isCancel(error)) {
          this.$message.error(error.msg || '系统错误')
        }
        return Promise.reject(error)
      } finally {
        removePending(config) // 在请求结束后，移除本次请求
        loadingSwitch(this, '')
      }
    }
  }

  function loadingSwitch(vm, loading) {
    // 如果loading为false,代表当前请求不参与loading状态计算
    if (loading === false) return
    // 如果loading为'',表示减少一层请求loading队列
    if (loading === '') {
      count--
      if (loadingInstance && count <= 0) {
        loadingInstance.close()
        count = 0
        loadingInstance = null
      }
    } else {
      count++
      if (!loadingInstance) {
        loadingInstance = vm.$loading(loading)
      }
    }
  }

  const prototype = Vue.prototype
  // 返回取消ajax的source,
  prototype.$getCancelTokenSource = function() {
    return axios.CancelToken.source()
  }
  prototype.$axios = {}
  ;['get', 'post', 'put', 'patch', 'delete'].forEach((v) => {
    prototype.$axios[v] = request(v).bind(prototype)
  })
}
