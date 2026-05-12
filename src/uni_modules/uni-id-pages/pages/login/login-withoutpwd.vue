<!-- 免密登录页 -->
<template>
	<view class="uni-content auth-login-page">
		<view class="auth-nav">
			<text class="auth-nav__spacer"></text>
			<text class="auth-nav__help" @click="showHelp">帮助</text>
		</view>
		<view class="login-logo">
			<image :src="logo"></image>
		</view>

		<view class="auth-panel">
			<text class="title">{{ pageTitle }}</text>
			<text class="tip">{{ pageTip }}</text>
			<!-- 快捷登录框 当url带参数时有效 -->
			<template v-if="['apple','weixin', 'weixinMobile', 'huawei', 'huaweiMobile'].includes(type)">
				<view class="quickLogin">
					<image v-if="type !== 'weixinMobile' && type !== 'huaweiMobile'" @click="quickLogin" :src="imgSrc" mode="widthFix"
						class="quickLoginBtn"></image>
					<view v-else style="position: relative">
						<button v-if="type ==='weixinMobile'" type="primary" open-type="getPhoneNumber" @getphonenumber="quickLogin"
						        class="uni-btn">微信授权手机号登录</button>
						<!-- #ifdef APP-HARMONY -->
						<app-harmony-get-phone-number
							v-if="type === 'huaweiMobile'"
							@getphonenumber="quickLogin"
						>
							<button class="quickLoginBtn" style="padding: 0; display: flex">
								<image :src="imgSrc" mode="widthFix"></image>
							</button>
						</app-harmony-get-phone-number>
						<!-- #endif -->
						<!-- #ifdef MP-HARMONY -->
						<button v-if="type === 'huaweiMobile'" open-type="getPhoneNumber" @getphonenumber="quickLogin"
						        class="quickLoginBtn" style="padding: 0; display: flex">
							<image :src="imgSrc" mode="widthFix"></image>
						</button>
						<!-- #endif -->
						<view v-if="this.needAgreements && !this.agree" class="mobile-login-agreement-layer" @click="showAgreementModal"></view>
					</view>
					<uni-id-pages-agreements scope="register" ref="agreements"></uni-id-pages-agreements>
				</view>
			</template>
			<template v-else>
				<view class="auth-field">
					<text class="auth-field__label">手机号</text>
					<view class="phone-box" :class="{ 'phone-box--focused': focusPhone }">
						<view @click="chooseArea" class="auth-field__prefix area">+86</view>
						<uni-easyinput trim="both" :focus="focusPhone" @focus="focusPhone = true" @blur="focusPhone = false" class="input-box" type="number"
							:inputBorder="false" primaryColor="#b8a08a" v-model="phone" maxlength="11" placeholder="请输入手机号" />
					</view>
				</view>
				<view class="auth-field" v-if="loginMode === 'password'">
					<text class="auth-field__label">密码</text>
					<view class="password-box" :class="{ 'password-box--focused': focusPassword }">
						<view class="password-toggle" @click.stop="togglePasswordVisible">
							<text class="material-icons-round password-toggle__icon">{{ showPassword ? 'visibility' : 'visibility_off' }}</text>
						</view>
						<uni-easyinput :focus="focusPassword" @focus="focusPassword = true" @blur="focusPassword = false" class="input-box"
							clearable :passwordIcon="false" :type="showPassword ? 'text' : 'password'" :inputBorder="false"
							primaryColor="#b8a08a" v-model="password" placeholder="请输入密码" trim="all" />
					</view>
				</view>
				<view class="auth-field" v-if="loginMode === 'password' && needCaptcha">
					<text class="auth-field__label">验证码</text>
					<uni-captcha focus ref="captcha" scene="login-by-pwd" v-model="captcha" />
				</view>
				<view class="link-box auth-mode-row" :class="{ 'link-box--split': loginMode === 'password' }">
					<view class="link-action" v-if="loginMode === 'smsCode'" @click="toPwdLogin">
						<text class="material-icons-round link-action__icon">swap_horiz</text>
						<text class="link-action__text">密码登录</text>
					</view>
					<view class="link-box__group" v-if="loginMode === 'password' && !config.isAdmin">
						<view class="link-action" @click="toSmsLogin">
							<text class="material-icons-round link-action__icon">swap_horiz</text>
							<text class="link-action__text">验证码登录</text>
						</view>
					</view>
					<view class="link-box__group" v-if="loginMode === 'password' && !config.isAdmin">
						<text class="link" @click="toRetrievePwd">找回密码</text>
					</view>
				</view>
				<button v-if="loginMode === 'smsCode'" class="uni-btn" :class="{ 'uni-btn--inactive': !isPhone }" type="primary" @click="toSmsPage">验证并登录</button>
				<button v-else class="uni-btn" type="primary" @click="pwdLogin">登录</button>
				<uni-id-pages-agreements :scope="agreementScope" :key="agreementScope" ref="agreements"></uni-id-pages-agreements>
			</template>
		</view>
		<!-- 固定定位的快捷登录按钮 -->
		<uni-id-pages-fab-login ref="uniFabLogin"></uni-id-pages-fab-login>
	</view>
</template>

<script>
	let currentWebview; //当前窗口对象
	import config from '@/uni_modules/uni-id-pages/config.js'
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	const uniIdCo = uniCloud.importObject("uni-id-co", {
		customUI: true
	})
	export default {
		mixins: [mixin],
		data() {
			return {
				type: "", //快捷登录方式
				loginMode: "smsCode",
				phone: "", //手机号码
				password: "",
				showPassword: false,
				captcha: "",
				needCaptcha: false,
				focusPhone: false,
				focusPassword: false,
				logo: "/static/logo.png"
			}
		},
		computed: {
			async loginTypes() { //读取配置的登录优先级
				return config.loginTypes
			},
			isPhone() { //手机号码校验正则
				return /^1\d{10}$/.test(this.phone);
			},
			imgSrc() { //大快捷登录按钮图
				const images = {
					weixin: '/uni_modules/uni-id-pages/static/login/weixin.png',
					apple: '/uni_modules/uni-id-pages/static/app/apple.png',
					huawei: '/uni_modules/uni-id-pages/static/login/huawei.png',
					huaweiMobile: '/uni_modules/uni-id-pages/static/login/huawei-mobile.png',
				}
				return images[this.type]
			},
			agreementScope() {
				return this.loginMode === 'password' ? 'login' : 'register'
			},
			pageTitle() {
				return '登录后体验完整功能'
			},
			pageTip() {
				if (this.loginMode === 'password') {
					return '已设置密码的手机号可直接登录'
				}
				return this.type == 'univerify'
					? '使用本机号码快速登录，也可以切换其他账号'
					: '未注册的手机号验证通过后将自动注册'
			}
		},
		async onLoad(e) {
			//获取通过url传递的参数type设置当前登录方式，如果没传递直接默认以配置的登录
			let type = e.type || config.loginTypes[0]
			if (e.phoneNumber) {
				this.phone = e.phoneNumber
			}
			this.setLoginType(type)

			// console.log("this.type: -----------",this.type);
			if (type != 'univerify') {
				this.focusPhone = true
			}
			this.$nextTick(() => {
				//关闭重复显示的登录快捷方式
				if (['weixin', 'apple', 'huawei', 'huaweiMobile'].includes(type)) {
					this.$refs.uniFabLogin.servicesList = this.$refs.uniFabLogin.servicesList.filter(item =>
						item.id != type)
				}
			})
			uni.$on('uni-id-pages-setLoginType', type => {
				this.setLoginType(type)
			})
		},
		onShow() {
			// #ifdef H5
			document.onkeydown = event => {
				var e = event || window.event;
				if (e && e.keyCode == 13) { //回车键的键值为13
					this.loginMode === 'password' ? this.pwdLogin() : this.toSmsPage()
				}
			};
			// #endif
		},
		onUnload() {
			uni.$off('uni-id-pages-setLoginType')
		},
		onReady() {
			// 是否优先启动一键登录。即：页面一加载就启动一键登录
			//#ifdef APP-PLUS
			if (config.loginTypes.includes('univerify') && this.type == "univerify") {
				uni.preLogin({
					provider: 'univerify',
					success: () => {
						const pages = getCurrentPages();
						currentWebview = pages[pages.length - 1].$getAppWebview();
						currentWebview.setStyle({
							"top": "2000px" // 隐藏当前页面窗体
						})
						// this.type == this.loginTypes[1]
						// console.log('开始一键登录');
						this.$refs.uniFabLogin.login_before('univerify')
					},
					fail: (err) => {
						console.log(err);
						this.fallbackToSmsLogin()
					}
				})
			}
			//#endif
		},
		methods: {
			showCurrentWebview(){
				// 恢复当前页面窗体的显示 一键登录，默认不显示当前窗口
				currentWebview?.setStyle({
					"top": 0
				})
			},
			fallbackToSmsLogin() {
				this.showCurrentWebview()
				this.setLoginType('smsCode')
			},
			setLoginType(type) {
				this.type = type
				this.loginMode = type === 'username' ? 'password' : 'smsCode'
				if (type != 'univerify') {
					this.focusPhone = true
				}
				if (this.loginMode === 'password') {
					this.$nextTick(() => {
						this.focusPassword = !!this.phone
						this.$refs.uniFabLogin?.updateServicesList?.()
					})
				} else {
					this.$nextTick(() => {
						this.$refs.uniFabLogin?.updateServicesList?.()
					})
				}
			},
			showAgreementModal () {
				this.$refs.agreements.popup()
			},
			quickLogin(e) {
				let options = {}
				console.log(e)
				if (e.detail?.code) {
					options.phoneNumberCode = e.detail.code
				}

				if ((this.type === 'weixinMobile' || this.type === 'huaweiMobile') && !e.detail?.code) return

				this.$refs.uniFabLogin.login_before(this.type, true, options)
			},
			toSmsPage() {
				if (!this.isPhone) {
					this.focusPhone = true
					return uni.showToast({
						title: "手机号码格式不正确",
						icon: 'none',
						duration: 3000
					});
				}
				if (this.needAgreements && !this.agree) {
					return this.$refs.agreements.popup(this.toSmsPage)
				}
				// 发送验证吗
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/login/login-smscode?phoneNumber=' + this.phone
				});
			},
			// 切换到密码登录
			toPwdLogin() {
				this.setLoginType('username')
			},
			toSmsLogin() {
				this.setLoginType('smsCode')
			},
			toRetrievePwd() {
				let url = '/uni_modules/uni-id-pages/pages/retrieve/retrieve'
				if (/^1\d{10}$/.test(this.phone)) {
					url += `?phoneNumber=${this.phone}`
				}
				uni.navigateTo({
					url
				})
			},
			togglePasswordVisible() {
				this.showPassword = !this.showPassword
			},
			pwdLogin() {
				if (!this.password.length) {
					this.focusPassword = true
					return uni.showToast({
						title: '请输入密码',
						icon: 'none',
						duration: 3000
					});
				}
				if (!this.phone.length) {
					this.focusPhone = true
					return uni.showToast({
						title: '请输入手机号',
						icon: 'none',
						duration: 3000
					});
				}
				if (!this.isPhone) {
					this.focusPhone = true
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

				const data = {
					mobile: this.phone,
					password: this.password,
					captcha: this.captcha
				}

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
						// 登录失败，自动重新获取验证码
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
			showHelp() {
				uni.showToast({
					title: this.loginMode === 'password' ? '可用短信验证码登录后设置密码' : '请使用手机号登录',
					icon: 'none'
				})
			},
			chooseArea() {
				uni.showToast({
					title: '暂不支持其他国家',
					icon: 'none',
					duration: 3000
				});
			},
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

	.mobile-login-agreement-layer {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}
	.uni-content,
	.quickLogin {
		/* #ifndef APP-NVUE */
		display: flex;
		flex-direction: column;
		/* #endif */
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
	// 解决小程序端开启虚拟节点virtualHost引起的 class = input-box丢失的问题 [详情参考](https://uniapp.dcloud.net.cn/matter.html#%E5%90%84%E5%AE%B6%E5%B0%8F%E7%A8%8B%E5%BA%8F%E5%AE%9E%E7%8E%B0%E6%9C%BA%E5%88%B6%E4%B8%8D%E5%90%8C-%E5%8F%AF%E8%83%BD%E5%AD%98%E5%9C%A8%E7%9A%84%E5%B9%B3%E5%8F%B0%E5%85%BC%E5%AE%B9%E9%97%AE%E9%A2%98)
	.phone-box ::v-deep .uni-easyinput__content,
	.phone-box ::v-deep .uni-easyinput__content.is-focused,
	.phone-box ::v-deep .uni-easyinput__content:focus-within,
	.password-box ::v-deep .uni-easyinput__content,
	.password-box ::v-deep .uni-easyinput__content.is-focused,
	.password-box ::v-deep .uni-easyinput__content:focus-within,
	/* #endif */
	.input-box {
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

	.quickLogin {
		height: 350px;
		align-items: center;
		justify-content: center;
	}

	.quickLoginBtn {
		margin: 20px 0;
		width: 450rpx;
		background-color: transparent;
		border: none;
		box-shadow: none;
		/* #ifndef APP-NVUE */
		max-width: 230px;
		/* #endif */
		height: 82rpx;
	}

	.tip {
		margin-bottom: 28px;
	}

	.auth-mode-row {
		margin-top: 2px;
	}

	@media screen and (min-width: 690px) {
		.quickLogin {
			height: auto;
		}
	}
</style>
