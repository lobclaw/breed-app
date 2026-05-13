<template>
	<uni-popup ref="popup" type="center" :mask-click="false">
		<view class="agreement-modal" @touchmove.stop.prevent>
			<text class="agreement-modal__title">{{ title }}</text>
			<view class="agreement-modal__body">
				<text class="agreement-modal__text">{{ prefix }}</text>
				<template v-for="(agreement, index) in agreements" :key="index">
					<text class="agreement-modal__link" @tap.stop="openAgreement(agreement)">{{ agreement.title }}</text>
					<text v-if="hasAnd(index)" class="agreement-modal__text"> 和 </text>
				</template>
				<text v-if="suffix" class="agreement-modal__text">{{ suffix }}</text>
			</view>
			<view class="agreement-modal__confirm" @tap.stop="confirm">
				<text class="agreement-modal__confirm-text">{{ confirmText }}</text>
			</view>
			<view class="agreement-modal__cancel" @tap.stop="cancel">
				<text class="agreement-modal__cancel-text">{{ cancelText }}</text>
			</view>
		</view>
	</uni-popup>
</template>

<script>
	export default {
		name: 'uni-id-pages-agreement-modal',
		props: {
			agreements: {
				type: Array,
				default() {
					return []
				}
			},
			title: {
				type: String,
				default: '用户协议及隐私政策'
			},
			prefix: {
				type: String,
				default: '已阅读并同意 '
			},
			suffix: {
				type: String,
				default: ''
			},
			confirmText: {
				type: String,
				default: '同意并继续'
			},
			cancelText: {
				type: String,
				default: '不同意'
			}
		},
		methods: {
			open() {
				this.$refs.popup.open()
			},
			close() {
				this.$refs.popup.close()
			},
			confirm() {
				this.$emit('confirm')
				this.close()
			},
			cancel() {
				this.$emit('cancel')
				this.close()
			},
			openAgreement(agreement) {
				this.$emit('link', agreement)
			},
			hasAnd(index) {
				return this.agreements.length - 1 > index
			}
		}
	}
</script>

<style lang="scss" scoped>
	/* #ifndef APP-NVUE */
	view {
		display: flex;
		box-sizing: border-box;
	}
	/* #endif */

	.agreement-modal {
		width: 72vw;
		max-width: 340px;
		min-width: 280px;
		padding: 30px 28px 22px;
		border-radius: 18px;
		background: var(--card, #ffffff);
		box-shadow: 0 18px 48px rgba(26, 26, 46, 0.16);
		flex-direction: column;
		align-items: center;
	}

	.agreement-modal__title {
		display: block;
		width: 100%;
		color: var(--text-1, #1a1a2e);
		font-size: 18px;
		font-weight: 800;
		line-height: 26px;
		text-align: center;
	}

	.agreement-modal__body {
		width: 100%;
		margin-top: 12px;
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
	}

	.agreement-modal__text,
	.agreement-modal__link {
		font-size: 14px;
		line-height: 22px;
		text-align: center;
	}

	.agreement-modal__text {
		color: var(--text-2, #8b7355);
	}

	.agreement-modal__link {
		color: var(--primary, #ea3e77);
		font-weight: 700;
	}

	.agreement-modal__confirm {
		width: 100%;
		height: 52px;
		margin-top: 24px;
		border-radius: 14px;
		background: var(--primary, #ea3e77);
		align-items: center;
		justify-content: center;
		box-shadow: 0 10px 24px rgba(234, 62, 119, 0.22);
		transition: transform 0.12s ease, opacity 0.12s ease;
	}

	.agreement-modal__confirm:active {
		opacity: 0.86;
		transform: scale(0.98);
	}

	.agreement-modal__confirm-text {
		color: #ffffff;
		font-size: 16px;
		font-weight: 800;
		line-height: 52px;
	}

	.agreement-modal__cancel {
		min-height: 40px;
		margin-top: 8px;
		padding: 0 16px;
		align-items: center;
		justify-content: center;
	}

	.agreement-modal__cancel-text {
		color: var(--text-3, #b8a08a);
		font-size: 14px;
		font-weight: 700;
		line-height: 40px;
	}
</style>
