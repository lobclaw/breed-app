<!-- 邮箱验证码注册 -->
<template>
	<view class="uni-content">
		<match-media :min-width="690">
			<view class="login-logo">
				<image :src="logo"></image>
			</view>
			<!-- 顶部文字 -->
			<text class="title title-box">邮箱验证码注册</text>
		</match-media>
		<uni-forms ref="form" :value="formData" :rules="rules" validate-trigger="submit" err-show-type="toast">
			<view class="auth-field">
				<text class="auth-field__label">邮箱</text>
				<uni-forms-item name="email">
					<uni-easyinput :inputBorder="false" :focus="focusEmail" @blur="focusEmail = false"
						class="input-box" placeholder="请输入邮箱" v-model="formData.email" trim="both" />
				</uni-forms-item>
			</view>
			<view class="auth-field">
				<text class="auth-field__label">昵称<text class="auth-field__optional">（选填）</text></text>
				<uni-forms-item name="nickname">
					<uni-easyinput :inputBorder="false" :focus="focusNickname" @blur="focusNickname = false" class="input-box" placeholder="可稍后填写"
					v-model="formData.nickname" trim="both" />
				</uni-forms-item>
			</view>
			<view class="auth-field">
				<text class="auth-field__label">密码</text>
				<uni-forms-item name="password" v-model="formData.password">
					<uni-easyinput :inputBorder="false" :focus="focusPassword" @blur="focusPassword = false"
						class="input-box" maxlength="20" placeholder="请输入8-20位密码" type="password"
						v-model="formData.password" trim="both" />
				</uni-forms-item>
			</view>
			<view class="auth-field">
				<text class="auth-field__label">确认密码</text>
				<uni-forms-item name="password2" v-model="formData.password2">
					<uni-easyinput :inputBorder="false" :focus="focusPassword2" @blur="focusPassword2 =false"
						class="input-box" placeholder="请再次输入密码" maxlength="20" type="password" v-model="formData.password2"
						trim="both" />
				</uni-forms-item>
			</view>
			<view class="auth-field">
				<text class="auth-field__label">邮箱验证码</text>
				<uni-forms-item name="code" >
					<uni-id-pages-email-form ref="shortCode" :email="formData.email" type="register" v-model="formData.code">
					</uni-id-pages-email-form>
				</uni-forms-item>
			</view>
			<uni-id-pages-agreements scope="register" ref="agreements" ></uni-id-pages-agreements>
			<button class="uni-btn" type="primary" @click="submit">注册</button>
			<button @click="navigateBack" class="register-back">返回</button>
			<match-media :min-width="690">
				<view class="link-box">
					<text class="link" @click="registerByUserName">用户名密码注册</text>
					<text class="link" @click="toLogin">已有账号？点此登录</text>
				</view>
			</match-media>
		</uni-forms>
	</view>
</template>

<script>
	import rules from './validator.js';
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	import passwordMod from '@/uni_modules/uni-id-pages/common/password.js'
	const uniIdCo = uniCloud.importObject("uni-id-co")
	export default {
		mixins: [mixin],
		data() {
			return {
				formData: {
					email: "",
					nickname: "",
					password: "",
					password2: "",
					code: ""
				},
				rules: {
					email: {
						rules: [{
								required: true,
								errorMessage: '请输入邮箱',
							},{
								format:'email',
								errorMessage: '邮箱格式不正确',
							}
						]
					},
					nickname: {
						rules: [{
								minLength: 3,
								maxLength: 32,
								errorMessage: '昵称长度在 {minLength} 到 {maxLength} 个字符',
							},
							{
								validateFunction: function(rule, value, data, callback) {
									// console.log(value);
									if (/^1\d{10}$/.test(value) || /^(\w-*\.*)+@(\w-?)+(\.\w{2,})+$/.test(value)) {
										callback('昵称不能是：手机号或邮箱')
									};
									if (/^\d+$/.test(value)) {
										callback('昵称不能为纯数字')
									};
									if(/[\u4E00-\u9FA5\uF900-\uFA2D]{1,}/.test(value)){
										callback('昵称不能包含中文')
									}
									return true
								}
							}
						],
						label: "昵称"
					},
					...passwordMod.getPwdRules(),
					code: {
						rules: [{
								required: true,
								errorMessage: '请输入邮箱验证码',
							},
							{
								pattern: /^.{6}$/,
								errorMessage: '邮箱验证码不正确',
							}
						]
					}
				},
				focusEmail:false,
				focusNickname:false,
				focusPassword:false,
				focusPassword2:false,
				logo: "/static/logo.png"
			}
		},
		onLoad() {
			uni.redirectTo({
				url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd?type=smsCode'
			})
		},
		onReady() {
			this.$refs.form && this.$refs.form.setRules(this.rules)
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
			 * 触发表单提交
			 */
			submit() {
				this.$refs.form.validate().then((res) => {
					if (this.needAgreements && !this.agree) {
						return this.$refs.agreements.popup(()=>{
							this.submitForm(res)
						})
					}
					this.submitForm(res)
				}).catch((errors) => {
					let key = errors[0].key
					key = key.replace(key[0], key[0].toUpperCase())
					// console.log(key);
					this['focus'+key] = true
				})
			},
			submitForm(params) {
				uniIdCo.registerUserByEmail(this.formData).then(e => {
					// console.log(e);
					uni.navigateTo({
						url: '/uni_modules/uni-id-pages/pages/login/login-withpwd',
						complete: (e) => {
							// console.log(e);
						}
					})
				})
				.catch(e => {
					// console.log(e);
					console.log(e.message);
				})
			},
			navigateBack() {
				uni.navigateBack()
			},
			toLogin() {
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/login/login-withpwd'
				})
			},
			registerByUserName() {
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/register/register'
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
