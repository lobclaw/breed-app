<template>
	<uni-popup ref="popup" type="center">
		<view class="popup-captcha">
			<view class="content">
				<text class="title">{{title}}</text>
				<uni-captcha :focus="focus" :scene="scene" v-model="val"></uni-captcha>
			</view>
			<view class="button-box">
				<view @click="close" class="btn">取消</view>
				<view @click="confirm" class="btn confirm">确认</view>
			</view>
		</view>
	</uni-popup>
</template>

<script>
	export default {
		data() {
			return {
				focus: false
			}
		},
		props: {
			modelValue:String,
			value:String,
			scene: {
				type: String,
				default () {
					return ""
				}
			},
			title: {
				type: String,
				default () {
					return ""
				}
			},
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
		methods: {
			open() {
				this.focus = true
				this.val = ""
				this.$refs.popup.open()
			},
			close() {
				this.focus = false
				this.$refs.popup.close()
			},
			confirm() {
				if(!this.val){
					return uni.showToast({
						title: '请填写验证码',
						icon: 'none'
					});
				}
				this.close()
				this.$emit('confirm')
			}
		}
	}
</script>

<style lang="scss" scoped>
	/* #ifndef APP-NVUE */
	view {
		display: flex;
		flex-direction: column;
	}

	/* #endif */
	.popup-captcha {
		/* #ifndef APP-NVUE */
		display: flex;
		max-width: 600px;
		/* #endif */
		width: 600rpx;
		padding-bottom: 0;
		background-color: var(--card, #fff);
		border-radius: 18px;
		box-shadow: 0 18px 48px rgba(45, 27, 20, 0.12);
		flex-direction: column;
		position: relative;
		overflow: hidden;
	}

	.popup-captcha .content {
		padding: 22px 18px 18px;
	}

	.popup-captcha .title {
		text-align: center;
		word-wrap: break-word;
		word-break: break-all;
		white-space: pre-wrap;
		font-weight: 800;
		font-size: 17px;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-1, #1a1a2e);
		margin-bottom: 15px;
	}

	.button-box {
		height: 48px;
		border-top: solid 1px rgba(216, 203, 189, 0.45);
		flex-direction: row;
		align-items: center;
		justify-content: space-around;
	}
	.button-box ,.btn{
		height: 48px;
		line-height: 48px;
	}
	.button-box .btn{
		flex: 1;
		margin: 1px;
		text-align: center;
		color: var(--text-2, #8b7355);
		font-size: 14px;
		font-weight: 700;
	}
	.button-box .confirm{
		color: var(--primary, #ea3e77);
		border-left: solid 1px rgba(216, 203, 189, 0.45);
	}
</style>
