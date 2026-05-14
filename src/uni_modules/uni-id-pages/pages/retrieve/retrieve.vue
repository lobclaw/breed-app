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
			<text class="title">找回密码</text>
			<text class="tip">{{ pageTip }}</text>
			<view class="auth-form">
				<view class="auth-field">
					<text class="auth-field__label">手机号</text>
					<view class="phone-box" :class="{ 'phone-box--focused': focusPhone }">
						<view @click="chooseArea" class="auth-field__prefix area">+86</view>
						<uni-easyinput
							:focus="focusPhone"
							@focus="focusPhone = true"
							@blur="focusPhone = false"
							class="input-box retrieve-input"
							type="number"
							:inputBorder="false"
							primaryColor="#b8a08a"
							:disabled="lock"
							trim="both"
							v-model="formData.phone"
							maxlength="11"
							placeholder="请输入手机号"
						/>
					</view>
				</view>

				<view class="auth-field retrieve-sms-field">
					<text class="auth-field__label">短信验证码</text>
					<view class="retrieve-sms-box" :class="{ 'retrieve-sms-box--focused': focusCode }">
						<view class="retrieve-sms-prefix">
							<text class="material-icons-round retrieve-sms-prefix__icon">sms</text>
						</view>
						<input
							class="retrieve-sms-input"
							type="number"
							:focus="focusCode"
							:value="formData.code"
							maxlength="6"
							placeholder="短信验证码"
							:disabled="submitting"
							@input="onCodeInput"
							@focus="focusCode = true"
							@blur="focusCode = false"
						/>
						<view
							class="retrieve-sms-action"
							:class="{ 'retrieve-sms-action--disabled': !canRequestSms || sendingSms }"
							@click="requestSmsCode"
						>
							<text class="retrieve-sms-action__text">{{ smsActionText }}</text>
						</view>
					</view>
				</view>

				<view class="auth-field">
					<text class="auth-field__label">新密码</text>
					<view class="password-box" :class="{ 'password-box--focused': focusPassword }">
						<view class="password-toggle" @click.stop="togglePasswordVisible('password')">
							<text class="material-icons-round password-toggle__icon">{{ showPassword ? 'visibility' : 'visibility_off' }}</text>
						</view>
						<uni-easyinput
							:focus="focusPassword"
							@focus="focusPassword = true"
							@blur="focusPassword = false"
							class="input-box retrieve-input"
							clearable
							:passwordIcon="false"
							:type="showPassword ? 'text' : 'password'"
							:inputBorder="false"
							primaryColor="#b8a08a"
							v-model="formData.password"
							trim="both"
							maxlength="20"
							placeholder="请输入新密码"
						/>
					</view>
				</view>

				<view class="auth-field">
					<text class="auth-field__label">再次输入密码</text>
					<view class="password-box" :class="{ 'password-box--focused': focusConfirmPassword }">
						<view class="password-toggle" @click.stop="togglePasswordVisible('confirm')">
							<text class="material-icons-round password-toggle__icon">{{ showConfirmPassword ? 'visibility' : 'visibility_off' }}</text>
						</view>
						<uni-easyinput
							:focus="focusConfirmPassword"
							@focus="focusConfirmPassword = true"
							@blur="focusConfirmPassword = false"
							class="input-box retrieve-input"
							clearable
							:passwordIcon="false"
							:type="showConfirmPassword ? 'text' : 'password'"
							:inputBorder="false"
							primaryColor="#b8a08a"
							v-model="formData.confirmPassword"
							trim="both"
							maxlength="20"
							placeholder="请再次输入新密码"
						/>
					</view>
				</view>

				<button
					class="uni-btn send-btn-box"
					:class="{ 'uni-btn--inactive': !canSubmit && !submitting }"
					type="primary"
					:disabled="submitting"
					@click="completeReset"
				>
					{{ submitting ? '登录中...' : '完成' }}
				</button>

				<uni-id-pages-agreements scope="login" ref="agreements" @setAgree="onAgreementChange"></uni-id-pages-agreements>
			</view>
		</view>
		<uni-popup-captcha
			@confirm="sendSmsCodeAfterCaptcha"
			v-model="formData.captcha"
			scene="send-sms-code"
			title="安全验证"
			ref="smsCaptchaPopup"
			:close-on-confirm="false"
			:confirm-loading="sendingSms"
			loading-text="发送中..."
		></uni-popup-captcha>
		<uni-popup-captcha
			@confirm="submitPasswordWithResetCaptcha"
			v-model="formData.resetCaptcha"
			scene="reset-pwd-by-sms"
			title="安全验证"
			ref="resetCaptchaPopup"
			:close-on-confirm="false"
			:confirm-loading="submitting"
			loading-text="登录中..."
		></uni-popup-captcha>
	</view>
</template>

<script>
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js'
	import passwordMod from '@/uni_modules/uni-id-pages/common/password.js'

	const uniIdCo = uniCloud.importObject("uni-id-co", {
		customUI: true,
		errorOptions: {
			type: 'toast'
		}
	})
	const RESEND_SECONDS = 300
	const SMS_RATE_LIMIT_ERROR = 'uni-id-sms-send-too-frequent'

	export default {
		mixins: [mixin],
		data() {
			return {
				lock: false,
				smsSent: false,
				sendingSms: false,
				submitting: false,
				focusPhone: true,
				focusCode: false,
				focusPassword: false,
				focusConfirmPassword: false,
				showPassword: false,
				showConfirmPassword: false,
				remainingSeconds: 0,
				countdownTimer: null,
				formData: {
					phone: '',
					code: '',
					password: '',
					confirmPassword: '',
					captcha: '',
					resetCaptcha: ''
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
			canRequestSms() {
				return this.remainingSeconds <= 0
			},
			canSubmit() {
				return this.isPhone && this.isCode && this.formData.password && this.formData.confirmPassword
			},
			pageTip() {
				if (this.smsSent) {
					return '验证码已发送，请输入短信验证码并设置新密码'
				}
				return '验证手机号后即可重设登录密码'
			},
			smsActionText() {
				if (this.sendingSms) return '发送中...'
				if (this.remainingSeconds > 0) return this.remainingSeconds + 's'
				return this.smsSent ? '重新获取' : '获取验证码'
			}
		},
		onLoad(event = {}) {
			if (event.phoneNumber) {
				this.formData.phone = event.phoneNumber
				this.lock = true
				this.focusPhone = false
			}
			if (event.lock) {
				this.lock = event.lock === true || event.lock === 'true'
			}
		},
		onShow() {
			// #ifdef H5
			document.onkeydown = event => {
				var e = event || window.event
				if (e && e.keyCode == 13) {
					this.completeReset()
				}
			}
			// #endif
		},
		onUnload() {
			this.clearCountdown()
		},
		watch: {
			'formData.phone'(value, oldValue) {
				if (value === oldValue) return
				this.smsSent = false
				this.formData.code = ''
				this.formData.captcha = ''
				this.formData.resetCaptcha = ''
				this.clearCountdown()
				this.remainingSeconds = 0
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
			ensureAgreement(nextAction) {
				if (this.needAgreements && !this.agree) {
					return this.$refs.agreements.popup(nextAction)
				}
				nextAction()
			},
			requestSmsCode() {
				if (this.sendingSms) return
				if (!this.canRequestSms) return
				if (!this.validatePhone()) return
				this.ensureAgreement(() => {
					this.formData.captcha = ''
					this.$refs.smsCaptchaPopup.open()
				})
			},
			togglePasswordVisible(type) {
				if (type === 'confirm') {
					this.showConfirmPassword = !this.showConfirmPassword
					return
				}
				this.showPassword = !this.showPassword
			},
			chooseArea() {
				uni.showToast({
					title: '暂不支持其他国家',
					icon: 'none',
					duration: 3000
				})
			},
			sendSmsCodeAfterCaptcha() {
				if (this.sendingSms) return
				if (!this.formData.captcha || this.formData.captcha.length !== 4) {
					return uni.showToast({
						title: '请输入图形验证码',
						icon: 'none',
						duration: 3000
					})
				}
				this.sendingSms = true
				uniIdCo.sendSmsCode({
					mobile: this.formData.phone,
					scene: 'reset-pwd-by-sms',
					captcha: this.formData.captcha
				}).then(result => {
					this.$refs.smsCaptchaPopup?.close?.(true)
					if (result && result.errCode === 'uni-id-invalid-sms-template-id') {
						uni.showToast({
							title: '测试模式，请输入 123456',
							icon: 'none',
							duration: 3000
						})
					} else {
						uni.showToast({
							title: '短信验证码发送成功',
							icon: 'none',
							duration: 2000
						})
					}
					this.smsSent = true
					this.startCountdown()
					this.focusSmsCodeInput()
				}).catch(e => {
					const errCode = e.code || e.errCode
					if (errCode === 'uni-id-invalid-sms-template-id') {
						this.$refs.smsCaptchaPopup?.close?.(true)
						uni.showToast({
							title: '测试模式，请输入 123456',
							icon: 'none',
							duration: 3000
						})
						this.smsSent = true
						this.startCountdown()
						this.focusSmsCodeInput()
					} else if (errCode === SMS_RATE_LIMIT_ERROR) {
						this.$refs.smsCaptchaPopup?.close?.(true)
						uni.showToast({
							title: '验证码请求过于频繁，请稍后再试',
							icon: 'none',
							duration: 3000
						})
					} else {
						this.formData.captcha = ''
						this.$refs.smsCaptchaPopup?.refresh?.()
						uni.showToast({
							title: e.message || e.errMsg || '短信验证码发送失败',
							icon: 'none',
							duration: 3000
						})
					}
				}).finally(() => {
					this.sendingSms = false
					this.formData.captcha = ''
				})
			},
			focusSmsCodeInput() {
				this.focusCode = false
				this.$nextTick(() => {
					this.focusCode = true
				})
			},
			onCodeInput(event) {
				const value = String(event.detail.value || '').replace(/\D/g, '').slice(0, 6)
				if (value !== this.formData.code) {
					this.formData.code = value
				}
			},
			validateResetForm() {
				if (!this.validatePhone()) return false
				if (!this.isCode) {
					this.focusSmsCodeInput()
					uni.showToast({
						title: this.formData.code ? '请输入6位验证码' : '请输入短信验证码',
						icon: 'none',
						duration: 3000
					})
					return false
				}
				const pwdCheck = passwordMod.validPwd(this.formData.password)
				if (pwdCheck !== true) {
					this.focusPassword = true
					uni.showToast({
						title: pwdCheck,
						icon: 'none',
						duration: 3000
					})
					return false
				}
				if (!this.formData.confirmPassword) {
					this.focusConfirmPassword = true
					uni.showToast({
						title: '请再次输入新密码',
						icon: 'none',
						duration: 3000
					})
					return false
				}
				if (this.formData.password !== this.formData.confirmPassword) {
					this.focusConfirmPassword = true
					uni.showToast({
						title: '两次输入的密码不一致',
						icon: 'none',
						duration: 3000
					})
					return false
				}
				return true
			},
			completeReset() {
				if (this.submitting) return
				this.ensureAgreement(() => {
					this.submitPassword()
				})
			},
			submitPassword() {
				if (this.submitting) return
				if (!this.validateResetForm()) return
				this.doResetPassword('')
			},
			submitPasswordWithResetCaptcha() {
				if (this.submitting) return
				if (!this.formData.resetCaptcha || this.formData.resetCaptcha.length !== 4) {
					return uni.showToast({
						title: '请输入图形验证码',
						icon: 'none',
						duration: 3000
					})
				}
				if (!this.validateResetForm()) return
				this.doResetPassword(this.formData.resetCaptcha)
			},
			doResetPassword(resetCaptcha) {
				if (this.submitting) return

				this.submitting = true
				const mobile = this.formData.phone
				const password = this.formData.password
				const params = {
					mobile,
					code: this.formData.code,
					password
				}
				if (resetCaptcha) {
					params.captcha = resetCaptcha
				}
				uniIdCo.resetPwdBySms(params).then(() => {
					this.$refs.resetCaptchaPopup?.close?.(true)
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
					const errCode = e.code || e.errCode
					if (errCode === 'uni-id-captcha-required') {
						this.formData.resetCaptcha = ''
						this.$refs.resetCaptchaPopup?.open?.()
					} else if (resetCaptcha) {
						this.formData.resetCaptcha = ''
						this.$refs.resetCaptchaPopup?.refresh?.()
						uni.showToast({
							title: e.message || e.errMsg,
							icon: 'none',
							duration: 3000
						})
					} else if (e.message || e.errMsg) {
						uni.showToast({
							title: e.message || e.errMsg,
							icon: 'none',
							duration: 3000
						})
					}
				}).finally(() => {
					this.submitting = false
				})
			},
			startCountdown() {
				this.clearCountdown()
				this.remainingSeconds = RESEND_SECONDS
				this.countdownTimer = setInterval(() => {
					this.remainingSeconds = Math.max(0, this.remainingSeconds - 1)
					if (this.remainingSeconds <= 0) {
						this.clearCountdown()
					}
				}, 1000)
			},
			clearCountdown() {
				if (!this.countdownTimer) return
				clearInterval(this.countdownTimer)
				this.countdownTimer = null
			},
			goBack() {
				const pages = getCurrentPages()
				if (pages.length > 1) {
					uni.navigateBack()
				} else {
					this.backLogin()
				}
			},
			showHelp() {
				uni.showToast({
					title: '请输入手机号并完成短信验证',
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

	.retrieve-page .auth-field {
		margin-bottom: 12px;
	}

	.retrieve-page .retrieve-sms-field {
		margin-top: 12px;
	}

	.phone-box,
	.password-box {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		flex-direction: row;
		align-items: center;
		width: 100%;
		height: 54px;
		border: 1px solid rgba(234, 62, 119, 0.08);
		border-radius: var(--radius-row, 14px);
		background: rgba(255, 255, 255, 0.92);
		box-shadow: 0 4px 14px rgba(234, 62, 119, 0.035);
		overflow: hidden;
		transition: border-color 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
	}

	.phone-box--focused,
	.password-box--focused {
		border-color: rgba(234, 62, 119, 0.48);
		background: var(--card, #fff);
		box-shadow: 0 6px 18px rgba(234, 62, 119, 0.1);
	}

	.password-toggle {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		position: relative;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 72px;
		height: 54px;
	}

	.password-toggle::after {
		content: "";
		position: absolute;
		top: 15px;
		right: 0;
		width: 1px;
		height: 24px;
		background: rgba(216, 203, 189, 0.56);
	}

	.password-toggle__icon {
		color: var(--text-2, #8b7355);
		font-size: 20px;
		line-height: 20px;
	}

	.area {
		position: relative;
	}

	.auth-field__prefix.area {
		width: 72px;
		min-width: 72px;
		padding: 0 18px;
		font-size: 15px;
		font-weight: 600;
	}

	.area::after {
		content: "";
		border: 4px solid transparent;
		border-top-color: var(--text-2);
		top: 12px;
		left: 6px;
		position: relative;
	}

	.area::before {
		content: "";
		position: absolute;
		top: 15px;
		right: 0;
		width: 1px;
		height: 24px;
		background: rgba(216, 203, 189, 0.56);
	}

	/* #ifdef MP */
	.phone-box ::v-deep .uni-easyinput__content,
	.phone-box ::v-deep .uni-easyinput__content.is-focused,
	.phone-box ::v-deep .uni-easyinput__content:focus-within,
	.password-box ::v-deep .uni-easyinput__content,
	.password-box ::v-deep .uni-easyinput__content.is-focused,
	.password-box ::v-deep .uni-easyinput__content:focus-within,
	/* #endif */
	.phone-box .input-box,
	.password-box .input-box {
		/* #ifndef APP-NVUE */
		box-sizing: border-box;
		/* #endif */
		flex: 1;
		border: none !important;
		border-color: transparent !important;
		background: transparent !important;
		box-shadow: none;
	}

	.phone-box ::v-deep .uni-easyinput__content,
	.password-box ::v-deep .uni-easyinput__content {
		border: none !important;
		border-radius: 0 !important;
		background: transparent !important;
		box-shadow: none !important;
	}

	.phone-box ::v-deep .uni-easyinput__content.is-focused,
	.phone-box ::v-deep .uni-easyinput__content:focus-within,
	.phone-box ::v-deep .uni-easyinput.input-box:focus-within,
	.password-box ::v-deep .uni-easyinput__content.is-focused,
	.password-box ::v-deep .uni-easyinput__content:focus-within,
	.password-box ::v-deep .uni-easyinput.input-box:focus-within {
		border: none !important;
		background: transparent !important;
		box-shadow: none !important;
	}

	.phone-box ::v-deep .content-clear-icon,
	.password-box ::v-deep .content-clear-icon {
		color: var(--text-3, #b8a08a) !important;
	}

	.phone-box ::v-deep .uni-input-placeholder,
	.phone-box ::v-deep .input-placeholder,
	.password-box ::v-deep .uni-input-placeholder,
	.password-box ::v-deep .input-placeholder {
		font-size: 15px;
	}

	.retrieve-page .retrieve-input ::v-deep .uni-easyinput__content-input,
	.retrieve-page .retrieve-input ::v-deep .uni-input-input,
	.retrieve-page .retrieve-input ::v-deep .uni-input-placeholder,
	.retrieve-page .retrieve-input ::v-deep .input-placeholder {
		font-size: 15px !important;
	}

	.retrieve-sms-box {
		display: flex;
		flex-direction: row;
		align-items: center;
		width: 100%;
		height: 54px;
		border: 1px solid rgba(234, 62, 119, 0.08);
		border-radius: var(--radius-row, 14px);
		background: rgba(255, 255, 255, 0.92);
		box-shadow: 0 4px 14px rgba(234, 62, 119, 0.035);
		overflow: hidden;
		transition: border-color 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
	}

	.retrieve-sms-box--focused {
		border-color: rgba(234, 62, 119, 0.42);
		background: var(--card, #fff);
		box-shadow: 0 6px 18px rgba(234, 62, 119, 0.1);
	}

	.retrieve-sms-prefix {
		display: flex;
		position: relative;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 72px;
		height: 54px;
	}

	.retrieve-sms-prefix::after {
		content: "";
		position: absolute;
		top: 15px;
		right: 0;
		width: 1px;
		height: 24px;
		background: rgba(216, 203, 189, 0.56);
	}

	.retrieve-sms-prefix__icon {
		color: var(--text-2, #8b7355);
		font-size: 20px;
		line-height: 20px;
	}

	.retrieve-sms-input {
		flex: 1;
		height: 54px;
		min-width: 0;
		padding: 0 12px 0 16px;
		border: none;
		background: transparent;
		color: var(--text-1, #1a1a2e);
		font-size: 15px;
		line-height: 54px;
	}

	.retrieve-sms-action {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		min-width: 86px;
		max-width: 112px;
		height: 34px;
		margin-right: 10px;
		padding: 0 12px;
		border-radius: 999px;
		background: rgba(234, 62, 119, 0.08);
	}

	.retrieve-sms-action__text {
		color: var(--primary, #ea3e77);
		font-size: 12px;
		font-weight: 700;
		line-height: 18px;
		text-align: center;
	}

	.retrieve-sms-action--disabled {
		background: rgba(184, 160, 138, 0.08);
	}

	.retrieve-sms-action--disabled .retrieve-sms-action__text {
		color: var(--text-3, #b8a08a);
	}

	@media screen and (min-width: 690px) {
		.uni-content{
			max-height: none;
		}
	}
</style>
