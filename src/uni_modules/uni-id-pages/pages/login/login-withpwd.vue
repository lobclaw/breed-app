<!-- 账号密码登录兼容页 -->
<template>
	<view class="uni-content auth-login-page"></view>
</template>

<script>
	export default {
		onLoad(e = {}) {
			const query = {
				...e,
				type: 'username'
			}
			const params = Object.keys(query)
				.filter(key => query[key] !== undefined && query[key] !== null && query[key] !== '')
				.map(key => `${key}=${encodeURIComponent(query[key])}`)
				.join('&')
			const url = '/uni_modules/uni-id-pages/pages/login/login-withoutpwd?' + params
			uni.redirectTo({
				url
			})
		}
	}
</script>

<style lang="scss" scoped>
	@import "@/uni_modules/uni-id-pages/common/login-page.scss";
</style>
