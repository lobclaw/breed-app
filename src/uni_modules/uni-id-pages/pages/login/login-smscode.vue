<!-- 短信验证码登录页 -->
<template>
	<view class="uni-content auth-login-page sms-code-page">
		<view class="auth-nav">
			<text class="auth-nav__action" @click="goBack">‹</text>
			<text class="auth-nav__help" @click="showHelp">帮助</text>
		</view>
		<view class="login-logo">
			<image :src="logo"></image>
		</view>
		<view class="auth-panel">
			<text class="title">请输入验证码</text>
			<view class="sms-tip">
				<text class="sms-tip__text">短信已发送至 </text>
				<text class="sms-tip__phone">{{ displayPhone }}</text>
			</view>

			<view class="otp-box" @tap="focusCodeInput">
				<view
					v-for="(digit, index) in codeDigits"
					:key="index"
					class="otp-cell"
					:class="{ 'otp-cell--filled': digit, 'otp-cell--active': isCellActive(index) }"
				>
					<text class="otp-cell__text">{{ digit }}</text>
					<view v-if="isCellActive(index)" class="otp-cell__cursor"></view>
				</view>
				<input
					class="otp-hidden-input"
					:focus="focusCode"
					type="number"
					maxlength="6"
					:value="code"
					:disabled="loggingIn"
					@input="onCodeInput"
					@focus="focusCode = true"
					@blur="focusCode = false"
				/>
			</view>

			<button
				class="uni-btn sms-login-btn"
				:class="{ 'uni-btn--inactive': !canSubmit && !loggingIn }"
				type="primary"
				@click="submit"
			>{{ loginButtonText }}</button>

			<view class="resend-row">
				<text
					class="resend-action"
					:class="{ 'resend-action--disabled': !canResend || resendSending }"
					@click="retrySend"
				>{{ resendText }}</text>
			</view>
		</view>
		<uni-popup-captcha @confirm="sendSmsCodeAfterCaptcha" v-model="resendCaptcha" scene="send-sms-code" title="安全验证" ref="resendCaptchaPopup"></uni-popup-captcha>
		<uni-popup-captcha @confirm="submit" v-model="captcha" scene="login-by-sms" title="安全验证" ref="popup"></uni-popup-captcha>
	</view>
</template>

<script>
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	const uniIdCo = uniCloud.importObject("uni-id-co", {
		errorOptions: {
			type: 'toast'
		}
	})
	const RESEND_SECONDS = 300
	const SMS_SENT_AT_STORAGE_PREFIX = 'uni-id-pages-login-sms-sent-at:'
	export default {
		mixins: [mixin],
		data() {
			return {
				code: "",
				phone: "",
				captcha: "",
				resendCaptcha: "",
				logo: "/static/logo.png",
				focusCode: false,
				remainingSeconds: RESEND_SECONDS,
				countdownTimer: null,
				loggingIn: false,
				resendSending: false
			}
		},
		computed: {
			codeDigits() {
				const digits = this.code.split('')
				return [0, 1, 2, 3, 4, 5].map(index => digits[index] || '')
			},
			canSubmit() {
				return this.code.length === 6
			},
			canResend() {
				return this.remainingSeconds <= 0
			},
			loginButtonText() {
				return this.loggingIn ? '登录中...' : '登录'
			},
			resendText() {
				if (this.resendSending) return '发送中...'
				if (this.remainingSeconds > 0) return this.remainingSeconds + ' 秒后重新发送'
				return '重新获取验证码'
			},
			displayPhone() {
				if (!this.phone) return '+86'
				return '+86 ' + this.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3')
			}
		},
		onLoad({
			phoneNumber,
			sentAt
		}) {
			this.phone = phoneNumber || ''
			const initialSentAt = this.getInitialSentAt(Number(sentAt))
			if (initialSentAt) {
				this.startCountdown(initialSentAt)
			} else {
				this.remainingSeconds = 0
			}
		},
		onReady() {
			this.focusCodeInput()
		},
		onShow() {
			// #ifdef H5
			document.onkeydown = event => {
				var e = event || window.event;
				if (e && e.keyCode == 13) { //回车键的键值为13
					this.submit()
				}
			};
			// #endif
		},
		onUnload() {
			this.clearCountdown()
		},
		watch: {
			code(value, oldValue) {
				if (value.length === 6 && oldValue.length !== 6) {
					this.submit(true)
				}
			}
		},
		methods: {
			goBack() {
				uni.navigateBack()
			},
			showHelp() {
				uni.showToast({
					title: '请输入短信验证码',
					icon: 'none'
				})
			},
			focusCodeInput() {
				if (this.loggingIn) return
				this.focusCode = false
				this.$nextTick(() => {
					this.focusCode = true
				})
			},
			onCodeInput(event) {
				const value = String(event.detail.value || '').replace(/\D/g, '').slice(0, 6)
				if (value !== this.code) {
					this.code = value
				}
			},
			isCellActive(index) {
				if (this.loggingIn) return false
				const activeIndex = Math.min(this.code.length, 5)
				return this.focusCode && index === activeIndex
			},
			submit() {
				if (this.loggingIn) return
				if (!this.canSubmit) {
					this.focusCodeInput()
					return uni.showToast({
						title: '请输入短信验证码',
						icon: 'none',
						duration: 3000
					})
				}
				this.loggingIn = true
				uniIdCo.loginBySms({
					mobile: this.phone,
					code: this.code,
					captcha: this.captcha
				}).then(e => {
					this.clearSentAtCache()
					this.loginSuccess(e)
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
					this.loggingIn = false
					this.captcha = ''
				})
			},
			retrySend() {
				if (!this.canResend || this.resendSending) return
				this.resendCaptcha = ''
				this.$refs.resendCaptchaPopup.open()
			},
			sendSmsCodeAfterCaptcha() {
				if (this.resendSending) return
				if (!this.resendCaptcha || this.resendCaptcha.length !== 4) {
					return uni.showToast({
						title: '请输入图形验证码',
						icon: 'none',
						duration: 3000
					})
				}
				this.resendSending = true
				uniIdCo.sendSmsCode({
					mobile: this.phone,
					scene: 'login-by-sms',
					captcha: this.resendCaptcha
				}).then(result => {
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
					this.startCountdown(Date.now())
					this.focusCodeInput()
				}).catch(e => {
					const errCode = e.code || e.errCode
					if (errCode === 'uni-id-invalid-sms-template-id') {
						uni.showToast({
							title: '测试模式，请输入 123456',
							icon: 'none',
							duration: 3000
						})
						this.startCountdown(Date.now())
						this.focusCodeInput()
					} else {
						uni.showToast({
							title: e.message || e.errMsg || '短信验证码发送失败',
							icon: 'none',
							duration: 3000
						})
					}
				}).finally(() => {
					this.resendSending = false
					this.resendCaptcha = ''
				})
			},
			startCountdown(sentAt) {
				this.clearCountdown()
				this.cacheSentAt(sentAt)
				const updateRemaining = () => {
					const elapsed = Math.floor((Date.now() - sentAt) / 1000)
					this.remainingSeconds = Math.max(0, RESEND_SECONDS - elapsed)
					if (this.remainingSeconds <= 0) {
						this.clearCountdown()
						this.clearSentAtCache()
					}
				}
				updateRemaining()
				if (this.remainingSeconds > 0) {
					this.countdownTimer = setInterval(updateRemaining, 1000)
				}
			},
			clearCountdown() {
				if (!this.countdownTimer) return
				clearInterval(this.countdownTimer)
				this.countdownTimer = null
			},
			getStorageKey() {
				return SMS_SENT_AT_STORAGE_PREFIX + (this.phone || 'unknown')
			},
			getInitialSentAt(routeSentAt) {
				const cachedSentAt = Number(uni.getStorageSync(this.getStorageKey()) || 0)
				const sentAt = Math.max(routeSentAt || 0, cachedSentAt || 0)
				if (sentAt <= 0) return 0
				const elapsed = Math.floor((Date.now() - sentAt) / 1000)
				return elapsed < RESEND_SECONDS ? sentAt : 0
			},
			cacheSentAt(sentAt) {
				if (!sentAt || sentAt <= 0) return
				uni.setStorageSync(this.getStorageKey(), String(sentAt))
			},
			clearSentAtCache() {
				uni.removeStorageSync(this.getStorageKey())
			}
		}
	}
</script>

<style scoped lang="scss">
	@import "@/uni_modules/uni-id-pages/common/login-page.scss";

	.sms-code-page {
		background: var(--bg, #fdf8f9);
	}

	.sms-tip {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		flex-wrap: wrap;
		margin: 0 0 44px;
	}

	.sms-tip__text {
		color: var(--text-3, #b8a08a);
		font-size: 15px;
		line-height: 24px;
		margin-right: 4px;
	}

	.sms-tip__phone {
		color: var(--text-1, #1a1a2e);
		font-size: 18px;
		font-weight: 500;
		line-height: 26px;
	}

	.otp-box {
		position: relative;
		display: flex;
		flex-direction: row;
		width: 100%;
		height: 56px;
		margin-bottom: 40px;
	}

	.otp-cell {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		height: 56px;
		margin-left: 8px;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(234, 62, 119, 0.08);
		box-shadow: 0 4px 14px rgba(234, 62, 119, 0.035);
	}

	.otp-cell:first-child {
		margin-left: 0;
	}

	.otp-cell--active {
		border-color: rgba(234, 62, 119, 0.42);
		background: var(--card, #ffffff);
		box-shadow: 0 8px 18px rgba(234, 62, 119, 0.1);
	}

	.otp-cell__text {
		color: var(--text-1, #1a1a2e);
		font-size: 24px;
		font-weight: 800;
		line-height: 1;
	}

	.otp-cell__cursor {
		width: 2px;
		height: 28px;
		border-radius: 2px;
		background: var(--primary, #ea3e77);
	}

	.otp-hidden-input {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		color: transparent;
		caret-color: transparent;
	}

	.sms-login-btn {
		margin-top: 0;
	}

	.resend-row {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		width: 100%;
		margin-top: 24px;
	}

	.resend-action {
		display: block;
		color: var(--primary, #ea3e77);
		font-size: 15px;
		font-weight: 700;
		line-height: 24px;
		text-align: center;
	}

	.resend-action--disabled {
		color: var(--text-3, #b8a08a);
	}
</style>
