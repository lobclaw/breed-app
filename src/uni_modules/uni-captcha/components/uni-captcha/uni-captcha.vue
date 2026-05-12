<template>
	<view class="captcha-box">
		<input @blur="focusCaptchaInput = false" :focus="focusCaptchaInput" type="text" class="captcha"
			:inputBorder="false" maxlength="4" v-model="val" placeholder="验证码">
		<view class="captcha-img-box" @click="getImageCaptcha">
			<uni-icons class="loding" size="20px" color="#BBB" v-if="loging" type="spinner-cycle"></uni-icons>
			<image v-if="captchaBase64" class="captcha-img" :class="{opacity:loging}" :src="captchaBase64"
				mode="aspectFit"></image>
			<view v-else class="captcha-placeholder">
				<text v-if="!loging">点击刷新</text>
			</view>
		</view>
	</view>
</template>

<script>
	export default {
		props: {
			modelValue:String,
			value:String,
			scene: {
				type: String,
				default () {
					return ""
				}
			},
			focus: {
				type: Boolean,
				default () {
					return false
				}
			}
		},
		computed:{
			val:{
				get(){
					return this.value||this.modelValue
				},
				set(value){
					// console.log(value);
					// TODO 兼容 vue2
					// #ifdef VUE2
					this.$emit('input', value);
					// #endif
					
					// TODO　兼容　vue3
					// #ifdef VUE3
					this.$emit('update:modelValue', value)
					// #endif
				}
			}
		},
		data() {
			return {
				focusCaptchaInput: false,
				captchaBase64: "",
				loging: false
			};
		},
		watch: {
			scene: {
				handler(scene) {
					if (scene) {
						this.getImageCaptcha(this.focus)
					} else {
						uni.showToast({
							title: 'scene不能为空',
							icon: 'none'
						});
					}
				},
				immediate:true
			}
		},
		methods: {
			getImageCaptcha(focus = true) {
				this.loging = true
				if (focus) {
					this.val = ''
					this.focusCaptchaInput = true
				}
				const uniIdCo = uniCloud.importObject("uni-captcha-co", {
					customUI: true
				})
				uniIdCo.getImageCaptcha({
						scene: this.scene
					}).then(result => {
						// console.log(result);
						this.captchaBase64 = result.captchaBase64
					})
					.catch(e => {
						uni.showToast({
							title: e.message,
							icon: 'none'
						});
					}).finally(e => {
						this.loging = false
					})
			}
		}
	}
</script>

<style lang="scss" scoped>
	.captcha-box {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		flex-direction: row;
		align-items: center;
		gap: 10px;
		flex: 1;
	}

	.captcha-img-box,
	.captcha {
		height: 54px;
		line-height: 54px;
	}

	.captcha-img-box {
		position: relative;
		flex-shrink: 0;
		overflow: hidden;
		background-color: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(234, 62, 119, 0.08);
		border-radius: var(--radius-row, 14px);
		cursor: pointer;
	}

	.captcha {
		background-color: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(234, 62, 119, 0.08);
		border-radius: var(--radius-row, 14px);
		color: var(--text-1, #1a1a2e);
		font-size: 15px;
		flex: 1;
		padding: 0 14px;
		/* #ifndef APP-NVUE */
		box-sizing: border-box;
		/* #endif */
	}

	.captcha-img-box,
	.captcha-img,
	.loding {
		height: 54px !important;
		width: 106px;
	}

	.captcha-placeholder {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		width: 106px;
		height: 54px;
		align-items: center;
		justify-content: center;
	}

	.captcha-placeholder text {
		color: var(--text-3, #b8a08a);
		font-size: 12px;
		font-weight: 600;
	}
	
	.captcha-img{
		cursor: pointer;
	}

	.loding {
		z-index: 9;
		color: #bbb;
		position: absolute;
		text-align: center;
		line-height: 54px;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		animation: rotate 1s linear infinite;
	}

	.opacity {
		opacity: 0.5;
	}

	@keyframes rotate {
		from {
			transform: translate(-50%, -50%) rotate(0deg)
		}

		to {
			transform: translate(-50%, -50%) rotate(360deg)
		}
	}
</style>
