<!--  -->
<template>
  <div @click="sdsd">hello</div>
</template>

<script>
export default {
  components: {},
  data() {
    return {
    }
  },
  computed: {},
  created() {

  },
  mounted() { },
  methods: {
    sdsd() {
      this._loadingHttp()
    },
    cancelHttp() { // 取消请求
      const source = this.$getCancelTokenSource()
      this.$axios.post('/test/demo', { a: 1 }, { cancelToken: source.token })
      source.cancel();
    },
    _ignoreMsgHttp() { // 忽略错误提示
      this.$axios.get('/test/demo', { b: 1 }, { _ignoreMsg: true })
    },
    _loadingHttp() { // 显示loading
      this.$axios.post('/test/demo', { b: 1 }, { _loading: true })
    },
    _mockHttp() { // 使用mock数据
      this.$axios.post('/test/demo', { b: 1 }, { _mock: true, _mockServerUrl: 'https://www.easy-mock.com', _mockServerId: '21323' })
    },
    _retryHttp() { // 请求失败重试
      this.$axios.post('/test/demo', { b: 1 }, { _retry: 2, _retryDelay: 1000 })
    },
  }
}

</script>
<style lang='scss' scoped>
</style>
