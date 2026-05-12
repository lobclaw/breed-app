<template>
	<view class="root" v-if="agreements.length">
		<template v-if="needAgreements">
			<view class="agreement-check-group" @tap.stop="setAgree">
				<view class="agreement-checkbox" :class="{ 'agreement-checkbox--checked': isAgree }">
					<text v-if="isAgree" class="agreement-checkbox__mark">&#10003;</text>
				</view>
				<text class="agreement-prefix">已阅读并同意</text>
			</view>
			<view class="agreement-links">
				<view class="item" v-for="(agreement,index) in agreements" :key="index">
					<view class="agreement-hit" @tap.stop="navigateTo(agreement)">
						<text class="agreement text">{{agreement.title}}</text>
					</view>
					<text class="text and" v-if="hasAnd(agreements,index)" space="nbsp"> 和 </text>
				</view>
			</view>
		</template>
		<!-- 弹出式 -->
		<uni-popup v-if="needAgreements||needPopupAgreements" ref="popupAgreement" type="center">
			<uni-popup-dialog confirmText="同意" @confirm="popupConfirm">
				<view class="content">
					<text class="text">请先阅读并同意</text>
					<view class="item" v-for="(agreement,index) in agreements" :key="index">
						<view class="agreement-hit" @tap.stop="navigateTo(agreement)">
							<text class="agreement text">{{agreement.title}}</text>
						</view>
						<text class="text and" v-if="hasAnd(agreements,index)" space="nbsp"> 和 </text>
					</view>
				</view>
			</uni-popup-dialog>
		</uni-popup>
	</view>
</template>

<script>
	import config from '@/uni_modules/uni-id-pages/config.js'
	let retryFun = ()=>console.log('为定义')
	/**
		* uni-id-pages-agreements
		* @description 用户服务协议和隐私政策条款组件
		* @property {String,Boolean} scope = [register|login]	作用于哪种场景如：register 注册（包括登录并注册，如：微信登录、苹果登录、短信验证码登录）、login 登录。默认值为：register
	*/
	export default {
		name: "uni-agreements",
		computed: {
			agreements() {
				if(!config.agreements){
					return []
				}
				let {serviceUrl,privacyUrl} = config.agreements
				return [
					{
						url:serviceUrl,
						title:"用户服务协议"
					},
					{
						url:privacyUrl,
						title:"隐私政策条款"
					}
				]
			}
		},
		props: {
			scope: {
				type: String,
				default(){
					return 'register'
				}
			},
		},
		methods: {
			popupConfirm(){
				this.isAgree = true
				retryFun()
				// this.$emit('popupConfirm')
			},
			popup(Fun){
				this.needPopupAgreements = true
				// this.needAgreements = true

				//::TODO 鸿蒙元服务暂不支持 createAnimation，等支持后再打开
				// #ifdef MP-HARMONY
					return uni.showModal({
						title: "提示",
						content: `请先阅读并同意${this.agreements.map(item=>`“${item.title}”`).join('和')}`,
					})
				// #endif
				// #ifndef MP-HARMONY
				this.$nextTick(()=>{
					if(Fun){
						retryFun = Fun
					}
					this.$refs.popupAgreement.open()
				})
				// #endif
			},
			navigateTo({
				url,
				title
			}) {
				if (!url) {
					return uni.showToast({
						title: '协议页面暂不可打开',
						icon: 'none'
					})
				}
				const targetUrl = url.substring(0, 1) === '/'
					? url
					: '/uni_modules/uni-id-pages/pages/common/webview/webview?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title)
				uni.navigateTo({
					url: targetUrl,
					success: res => {},
					fail: (error) => {
						console.error('[agreements] navigate failed', targetUrl, error)
						uni.showToast({
							title: '协议页面暂不可打开',
							icon: 'none'
						})
					},
					complete: () => {}
				});
			},
			hasAnd(agreements, index) {
				return agreements.length - 1 > index
			},
			setAgree() {
				this.isAgree = !this.isAgree
				this.$emit('setAgree', this.isAgree)
			}
		},
		created() {
			this.needAgreements = (config?.agreements?.scope || []).includes(this.scope)
		},
		data() {
			return {
				isAgree: false,
				needAgreements:true,
				needPopupAgreements:false
			};
		}
	}
</script>

<style lang="scss" scoped>
	/* #ifndef APP-NVUE */
	view {
		display: flex;
		box-sizing: border-box;
		flex-direction: column;
	}

	/* #endif */
	.root {
		flex-direction: row;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		width: 100%;
		padding: 0 4px;
		min-height: 30px;
		margin-top: 14px;
		font-size: 12px;
		color: var(--text-3, #b8a08a);
	}

	.agreement-check-group {
		display: flex;
		flex-direction: row;
		align-items: center;
		flex: 0 0 auto;
		min-width: 0;
		min-height: 30px;
		padding-right: 1px;
	}

	.agreement-checkbox {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 12px;
		height: 12px;
		margin-right: 3px;
		border: 1px solid var(--text-4, #d8cbbd);
		border-radius: 50%;
		background: #FFFFFF;
		box-sizing: border-box;
		flex-shrink: 0;
	}

	.agreement-checkbox--checked {
		border-color: var(--primary, #ea3e77);
		background: var(--primary, #ea3e77);
	}

	.agreement-checkbox__mark {
		color: #FFFFFF;
		font-size: 9px;
		font-weight: 800;
		line-height: 12px;
	}

	.agreement-prefix {
		color: var(--text-3, #b8a08a);
		font-size: 12px;
		line-height: 30px;
		white-space: nowrap;
	}

	.item {
		flex-direction: row;
		align-items: center;
		flex: 0 0 auto;
	}
	.text{
		line-height: 30px;
		white-space: nowrap;
	}
	.agreement-hit {
		min-height: 30px;
		padding: 0 2px;
		flex-direction: row;
		align-items: center;
		cursor: pointer;
		flex: 0 0 auto;
	}
	.agreement {
		color: var(--primary, #ea3e77);
		font-weight: 700;
		cursor: pointer;
	}

	.content,
	.agreement-links{
		flex-wrap: wrap;
		flex-direction: row;
		flex: 0 0 auto;
		min-width: 0;
		justify-content: center;
		overflow: visible;
	}

	.root ::v-deep .uni-popup__error{
		color: #333333;
	}
</style>
