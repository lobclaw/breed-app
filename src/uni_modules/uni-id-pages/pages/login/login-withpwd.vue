<!-- 账号密码登录页 -->
<template>
	<view class="uni-content auth-login-page">
		<view class="auth-nav">
			<text class="auth-nav__action" @click="goBack">‹</text>
			<text class="auth-nav__help" @click="showHelp">帮助</text>
		</view>
		<view class="login-logo">
			<image :src="logo"></image>
		</view>

		<view class="auth-panel">
			<text class="title title-box">手机号密码登录</text>
			<uni-forms>
				<view class="auth-field">
					<text class="auth-field__label">手机号</text>
					<uni-forms-item name="username">
						<uni-easyinput :focus="focusUsername" @blur="focusUsername = false" class="input-box"
							:inputBorder="false" v-model="username" placeholder="请输入手机号" trim="all" />
					</uni-forms-item>
				</view>
				<view class="auth-field">
					<text class="auth-field__label">密码</text>
					<uni-forms-item name="password">
							<uni-easyinput :focus="focusPassword" @blur="focusPassword = false" class="input-box" clearable
							               type="password" :inputBorder="false" v-model="password" placeholder="请输入密码" trim="all" />
					</uni-forms-item>
				</view>
			</uni-forms>
			<view class="auth-field" v-if="needCaptcha">
				<text class="auth-field__label">验证码</text>
				<uni-captcha focus ref="captcha" scene="login-by-pwd" v-model="captcha" />
			</view>
			<view class="link-box">
				<view class="link-box__group" v-if="!config.isAdmin">
					<view class="link-action" @click="toSmsLogin">
						<text class="material-icons-round link-action__icon">swap_horiz</text>
						<text class="link-action__text">验证码登录</text>
					</view>
				</view>
				<view class="link-box__group" v-if="!config.isAdmin">
					<text class="link" @click="toRetrievePwd">找回密码</text>
				</view>
			</view>
			<button class="uni-btn" type="primary" @click="pwdLogin">登录</button>
			<!-- 带选择框的隐私政策协议组件 -->
			<uni-id-pages-agreements scope="login" ref="agreements"></uni-id-pages-agreements>
		</view>
		<!-- 悬浮登录方式组件 -->
		<uni-id-pages-fab-login ref="uniFabLogin"></uni-id-pages-fab-login>
	</view>
</template>

<script>
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	const uniIdCo = uniCloud.importObject("uni-id-co", {
		customUI: true
	})
	export default {
		mixins: [mixin],
		data() {
			return {
				"password": "",
				"username": "",
				"captcha": "",
				"needCaptcha": false,
				"focusUsername": false,
				"focusPassword": false,
				"logo": "/static/logo.png"
			}
		},
		onShow() {
			// #ifdef H5
			document.onkeydown = event => {
				var e = event || window.event;
				if (e && e.keyCode == 13) { //回车键的键值为13
					this.pwdLogin()
				}
			};
			// #endif
		},
		methods: {
			// 页面跳转，找回密码
			toRetrievePwd() {
				let url = '/uni_modules/uni-id-pages/pages/retrieve/retrieve'
				//如果刚好用户名输入框的值为手机号码，就把它传到retrieve页面，根据该手机号找回密码
				if (/^1\d{10}$/.test(this.username)) {
					url += `?phoneNumber=${this.username}`
				}
				uni.navigateTo({
					url
				})
			},
			/**
			 * 密码登录
			 */
			pwdLogin() {
				if (!this.password.length) {
					this.focusPassword = true
					return uni.showToast({
						title: '请输入密码',
						icon: 'none',
						duration: 3000
					});
				}
				if (!this.username.length) {
					this.focusUsername = true
					return uni.showToast({
						title: '请输入手机号',
						icon: 'none',
						duration: 3000
					});
				}
				if (!/^1\d{10}$/.test(this.username)) {
					this.focusUsername = true
					return uni.showToast({
						title: '手机号格式不正确',
						icon: 'none',
						duration: 3000
					});
				}
				if (this.needCaptcha && this.captcha.length != 4) {
					this.$refs.captcha.getImageCaptcha()
					return uni.showToast({
						title: '请输入验证码',
						icon: 'none',
						duration: 3000
					});
				}

				if (this.needAgreements && !this.agree) {
					return this.$refs.agreements.popup(this.pwdLogin)
				}

				let data = {
					"password": this.password,
					"captcha": this.captcha
				}

				data.mobile = this.username

				uni.showLoading({
					title: '登录中...',
					mask: true
				})

				uniIdCo.login(data).then(e => {
					this.loginSuccess(e)
				}).catch(e => {
					if (e.errCode == 'uni-id-captcha-required') {
						this.needCaptcha = true
					} else if (this.needCaptcha) {
						//登录失败，自动重新获取验证码
						this.$refs.captcha.getImageCaptcha()
					}
					if (e.message || e.errMsg) {
						uni.showToast({
							title: e.message || e.errMsg,
							icon: 'none',
							duration: 3000
						})
					}
				}).finally(() => {
					uni.hideLoading()
				})
			},
			toSmsLogin() {
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd?type=smsCode'
				})
			},
			goBack() {
				const pages = getCurrentPages()
				if (pages.length > 1) {
					uni.navigateBack()
				} else {
					uni.redirectTo({
						url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd?type=smsCode'
					})
				}
			},
			showHelp() {
				uni.showToast({
					title: '可用短信验证码登录后设置密码',
					icon: 'none'
				})
			}
		}
	}
</script>

<style lang="scss" scoped>
	@import "@/uni_modules/uni-id-pages/common/login-page.scss";

	@media screen and (min-width: 690px) {
		.uni-content {
			height: auto;
		}
	}
</style>
