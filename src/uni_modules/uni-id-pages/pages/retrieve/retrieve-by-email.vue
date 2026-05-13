<!-- 找回密码页 -->
<template>
	<view class="uni-content">
		<view class="auth-nav">
			<text class="auth-nav__action" @click="goBack">‹</text>
			<text class="auth-nav__help" @click="showHelp">帮助</text>
		</view>
		<view class="login-logo">
			<image :src="logo"></image>
		</view>
		<view class="auth-panel">
			<text class="title">找回密码</text>
			<text class="tip">通过邮箱验证后重置密码</text>
			<uni-forms class="auth-form" ref="form" :value="formData" err-show-type="toast">
				<view class="auth-field">
					<text class="auth-field__label">邮箱</text>
					<uni-forms-item name="email">
						<uni-easyinput :focus="focusEmail" @blur="focusEmail = false" class="input-box" :disabled="lock" :inputBorder="false" trim="both"
							v-model="formData.email" placeholder="请输入邮箱">
						</uni-easyinput>
					</uni-forms-item>
				</view>
				<view class="auth-field">
					<text class="auth-field__label">邮箱验证码</text>
					<uni-forms-item name="code">
						<uni-id-pages-email-form ref="shortCode" :email="formData.email" type="reset-pwd-by-email" v-model="formData.code">
						</uni-id-pages-email-form>
					</uni-forms-item>
				</view>
				<view class="auth-field">
					<text class="auth-field__label">新密码</text>
					<uni-forms-item name="password">
						<uni-easyinput :focus="focusPassword" @blur="focusPassword = false" class="input-box" type="password" :inputBorder="false" v-model="formData.password" trim="both"
							maxlength="20" placeholder="请输入8-20位新密码"></uni-easyinput>
					</uni-forms-item>
				</view>
				<view class="auth-field">
					<text class="auth-field__label">确认密码</text>
					<uni-forms-item name="password2">
						<uni-easyinput :focus="focusPassword2" @blur="focusPassword2 = false" class="input-box" type="password" :inputBorder="false" v-model="formData.password2" trim="both"
							placeholder="请再次输入新密码"></uni-easyinput>
					</uni-forms-item>
				</view>
				<button class="uni-btn send-btn-box" type="primary" @click="submit">提交</button>
				<view class="link-box auth-retrieve-links">
					<text class="link" @click="retrieveByPhone">通过手机验证码找回密码</text>
					<text class="link" @click="backLogin">返回登录</text>
				</view>
			</uni-forms>
		</view>
		<uni-popup-captcha @confirm="submit" v-model="formData.captcha" scene="reset-pwd-by-sms" ref="popup"></uni-popup-captcha>
	</view>
</template>

<script>
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	import passwordMod from '@/uni_modules/uni-id-pages/common/password.js'
	const uniIdCo = uniCloud.importObject("uni-id-co",{
		errorOptions:{
			type:'toast'
		}
	})
	export default {
		mixins: [mixin],
		data() {
			return {
				lock: false,
				focusEmail:true,
				focusPassword:false,
				focusPassword2:false,
				formData: {
					"email": "",
					"code": "",
					'password': '',
					'password2': '',
					"captcha": ""
				},
				rules: {
					email: {
						rules: [{
								required: true,
								errorMessage: '请输入邮箱',
							},
							{
								format:'email',
								errorMessage: '邮箱格式不正确',
							}
						]
					},
					code: {
						rules: [{
								required: true,
								errorMessage: '请输入邮箱验证码',
							},
							{
								pattern: /^.{6}$/,
								errorMessage: '请输入6位验证码',
							}
						]
					},
					...passwordMod.getPwdRules()
				},
				logo: "/static/logo.png"
			}
		},
		computed: {
			isEmail() {
				let reg_email = /@/;
				let isEmail = reg_email.test(this.formData.email);
				return isEmail;
			},
			isPwd() {
				let reg_pwd = /^.{6,20}$/;
				let isPwd = reg_pwd.test(this.formData.password);
				return isPwd;
			},
			isCode() {
				let reg_code = /^\d{6}$/;
				let isCode = reg_code.test(this.formData.code);
				return isCode;
			}
		},
		onLoad(event) {
			if (event && event.emailNumber) {
				this.formData.email = event.emailNumber;
				if(event.lock){
					this.lock = event.lock //如果是已经登录的账号，点击找回密码就锁定指定的账号绑定的邮箱码
					this.focusEmail = true
				}
			}
		},
		onReady() {
			if (this.formData.email) {
				this.$refs.shortCode.start();
			}
			this.$refs.form.setRules(this.rules)
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
		methods: {
			/**
			 * 完成并提交
			 */
			submit() {
				this.$refs.form.validate()
					.then(res => {
						let {
							email,
							password: password,
							captcha,
							code
						} = this.formData
						uniIdCo.resetPwdByEmail({
								email,
								code,
								password,
								captcha
							}).then(e => {
								uni.navigateTo({
									url: '/uni_modules/uni-id-pages/pages/login/login-withpwd',
									complete: (e) => {
										// console.log(e);
									}
								})
							})
							.catch(e => {
								if (e.errCode == 'uni-id-captcha-required') {
									this.$refs.popup.open()
								}
							}).finally(e => {
								this.formData.captcha = ""
							})
					}).catch(errors=>{
						let key = errors[0].key
						if(key == 'code'){
							return this.$refs.shortCode.focusSmsCodeInput = true
						}
						key = key.replace(key[0], key[0].toUpperCase())
						this['focus'+key] = true
					})
			},
			retrieveByPhone() {
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/retrieve/retrieve'
				})
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
					title: '请填写验证码并设置新密码',
					icon: 'none'
				})
			},
			backLogin () {
				uni.redirectTo({
					url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd'
				})
			}
		}
	}
</script>

<style lang="scss">
	@import "@/uni_modules/uni-id-pages/common/login-page.scss";

	@media screen and (min-width: 690px) {
		.uni-content{
			max-height: none;
		}
	}
</style>
