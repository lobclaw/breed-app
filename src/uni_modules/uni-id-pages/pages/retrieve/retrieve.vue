<!-- 找回密码页 -->
<template>
	<view class="uni-content retrieve-page">
		<view class="auth-nav">
			<text class="auth-nav__action" @click="goBack">‹</text>
			<text class="auth-nav__help" @click="showHelp">帮助</text>
		</view>
		<view class="login-logo">
			<image :src="logo"></image>
		</view>
		<view class="auth-panel">
			<template v-if="step === 'verify'">
				<text class="title">找回密码</text>
				<text class="tip">{{ verifyTip }}</text>
				<view class="auth-form">
					<view v-if="!lock" class="auth-field">
						<text class="auth-field__label">手机号</text>
						<uni-easyinput
							:focus="focusPhone"
							@focus="focusPhone = true"
							@blur="focusPhone = false"
							class="input-box retrieve-input"
							type="number"
							:inputBorder="false"
							trim="both"
							v-model="formData.phone"
							maxlength="11"
							placeholder="请输入手机号"
						/>
					</view>
					<view class="auth-field">
						<text class="auth-field__label">短信验证码</text>
						<uni-id-pages-sms-form
							ref="shortCode"
							:phone="formData.phone"
							type="reset-pwd-by-sms"
							v-model="formData.code"
							@send-success="smsSent = true"
						/>
					</view>
					<uni-id-pages-agreements scope="login" ref="agreements"></uni-id-pages-agreements>
					<button class="uni-btn send-btn-box" :class="{ 'uni-btn--inactive': !canGoNext }" type="primary" @click="completeVerify">下一步</button>
				</view>
			</template>

			<template v-else>
				<text class="title">请输入新登录密码</text>
				<text class="tip password-tip">{{ passwordTip }}</text>
				<view class="auth-form">
					<view class="auth-field">
						<text class="auth-field__label">新密码</text>
						<uni-easyinput
							:focus="focusPassword"
							@focus="focusPassword = true"
							@blur="focusPassword = false"
							class="input-box"
							type="password"
							:inputBorder="false"
							v-model="formData.password"
							trim="both"
							maxlength="20"
							placeholder="请输入密码"
						/>
					</view>
					<button class="uni-btn send-btn-box" type="primary" :disabled="submitting" @click="submitPassword">
						{{ submitting ? '登录中...' : '完成' }}
					</button>
				</view>
			</template>
		</view>
		<uni-popup-captcha @confirm="submitPassword" v-model="formData.captcha" scene="reset-pwd-by-sms" ref="popup"></uni-popup-captcha>
	</view>
</template>

<script>
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js'
	import passwordMod from '@/uni_modules/uni-id-pages/common/password.js'

	const uniIdCo = uniCloud.importObject("uni-id-co", {
		errorOptions: {
			type: 'toast'
		}
	})

	export default {
		mixins: [mixin],
		data() {
			return {
				step: 'verify',
				lock: false,
				smsSent: false,
				submitting: false,
				focusPhone: true,
				focusPassword: false,
				formData: {
					phone: '',
					code: '',
					password: '',
					captcha: ''
				},
				logo: "/static/logo.png",
				passwordTip: passwordMod.PASSWORD_TIP
			}
		},
		computed: {
			isPhone() {
				return /^1\d{10}$/.test(this.formData.phone)
			},
			isCode() {
				return /^\d{6}$/.test(this.formData.code)
			},
			canGoNext() {
				return this.isPhone && this.isCode
			},
			verifyTip() {
				if (!this.formData.phone) {
					return '请输入手机号并完成验证'
				}
				const action = this.smsSent ? '验证码已通过短信发送至' : '验证码将通过短信发送至'
				return action + ' +86 ' + this.formData.phone
			}
		},
		onLoad(event = {}) {
			if (event.phoneNumber) {
				this.formData.phone = event.phoneNumber
				this.lock = true
				this.focusPhone = false
			}
			if (event.lock) {
				this.lock = event.lock
			}
		},
		onShow() {
			// #ifdef H5
			document.onkeydown = event => {
				var e = event || window.event
				if (e && e.keyCode == 13) {
					this.step === 'verify' ? this.completeVerify() : this.submitPassword()
				}
			}
			// #endif
		},
		watch: {
			'formData.phone'(value, oldValue) {
				if (value === oldValue) return
				this.smsSent = false
				this.formData.code = ''
			}
		},
		methods: {
			validatePhone() {
				if (!this.formData.phone.length) {
					this.focusPhone = true
					uni.showToast({
						title: '请输入手机号',
						icon: 'none',
						duration: 3000
					})
					return false
				}
				if (!this.isPhone) {
					this.focusPhone = true
					uni.showToast({
						title: '请输入正确的手机号',
						icon: 'none',
						duration: 3000
					})
					return false
				}
				return true
			},
			completeVerify() {
				if (!this.validatePhone()) return
				if (!this.isCode) {
					this.$refs.shortCode.focusSmsCodeInput = true
					return uni.showToast({
						title: this.formData.code ? '请输入6位验证码' : '请输入短信验证码',
						icon: 'none',
						duration: 3000
					})
				}
				if (this.needAgreements && !this.agree) {
					return this.$refs.agreements.popup(() => {
						this.step = 'password'
						this.focusPassword = true
					})
				}
				this.step = 'password'
				this.focusPassword = true
			},
			submitPassword() {
				if (this.submitting) return
				const pwdCheck = passwordMod.validPwd(this.formData.password)
				if (pwdCheck !== true) {
					this.focusPassword = true
					return uni.showToast({
						title: pwdCheck,
						icon: 'none',
						duration: 3000
					})
				}

				this.submitting = true
				const mobile = this.formData.phone
				const password = this.formData.password
				uniIdCo.resetPwdBySms({
					mobile,
					code: this.formData.code,
					password,
					captcha: this.formData.captcha
				}).then(() => {
					return uniIdCo.login({
						mobile,
						password
					}).then(e => {
						this.loginSuccess(e)
					}).catch(() => {
						uni.showToast({
							title: '密码已重置，请重新登录',
							icon: 'none',
							duration: 3000
						})
						this.backLogin(mobile)
					})
				}).catch(e => {
					if (e.errCode == 'uni-id-captcha-required') {
						this.$refs.popup.open()
					} else if (e.message || e.errMsg) {
						uni.showToast({
							title: e.message || e.errMsg,
							icon: 'none',
							duration: 3000
						})
					}
				}).finally(() => {
					this.submitting = false
					this.formData.captcha = ''
				})
			},
			goBack() {
				if (this.step === 'password') {
					this.step = 'verify'
					return
				}
				const pages = getCurrentPages()
				if (pages.length > 1) {
					uni.navigateBack()
				} else {
					this.backLogin()
				}
			},
			showHelp() {
				uni.showToast({
					title: this.step === 'verify' ? '请先完成手机号验证' : '请设置新的登录密码',
					icon: 'none'
				})
			},
			backLogin(phone) {
				const query = phone ? '?type=username&phoneNumber=' + phone : ''
				uni.redirectTo({
					url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd' + query
				})
			}
		}
	}
</script>

<style lang="scss">
	@import "@/uni_modules/uni-id-pages/common/login-page.scss";

	.retrieve-page .auth-form {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.retrieve-page .password-tip {
		max-width: 100%;
	}

	.retrieve-page .retrieve-input ::v-deep .uni-easyinput__content-input,
	.retrieve-page .retrieve-input ::v-deep .uni-input-input,
	.retrieve-page .retrieve-input ::v-deep .uni-input-placeholder,
	.retrieve-page .retrieve-input ::v-deep .input-placeholder {
		font-size: 15px !important;
	}

	@media screen and (min-width: 690px) {
		.uni-content{
			max-height: none;
		}
	}
</style>
