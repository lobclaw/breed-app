<template>
	<button open-type="chooseAvatar" @chooseavatar="bindchooseavatar" @click="uploadAvatarImg" class="box" :class="{'showBorder':border}"  :style="{width,height,lineHeight:height}">
		<cloud-image v-if="avatar_file" :src="avatar_file.url" :width="width" :height="height"></cloud-image>
		<uni-icons v-else :style="{width,height,lineHeight:height}" class="chooseAvatar" type="plusempty" size="30"
			color="#dddddd"></uni-icons>
	</button>
</template>

<script>
	import {
		store,
		mutations
	} from '@/uni_modules/uni-id-pages/common/store.js'
	import { prepareLocalImage, uploadLocalImage } from '@/utils/imageAttachment'
	/**
	* uni-id-pages-avatar
	* @description 用户头像组件
	* @property {String} width	图片的宽，默认为：50px
	* @property {String} height	图片的高，默认为：50px
	*/
	export default {
		data() {
			return {
				isPC: false
			}
		},
		props: {
			//头像图片宽
			width: {
				type: String,
				default () {
					return "50px"
				}
			},
			//头像图片高
			height: {
				type: String,
				default () {
					return "50px"
				}
			},
			border:{
				type: Boolean,
				default () {
					return false
				}
			}
		},
		async mounted() {
			// #ifdef H5
			const platform = uni.getSystemInfoSync().platform
			this.isPC = !['ios', 'android'].includes(platform) || platform === 'harmonyos';
			// #endif
		},
		computed: {
			hasLogin() {
				return store.hasLogin
			},
			userInfo() {
				return store.userInfo
			},
			avatar_file() {
				return store.userInfo.avatar_file
			}
		},
		methods: {
			setAvatarFile(avatar_file) {
				// 使用 clientDB 提交数据
				mutations.updateUserInfo({avatar_file})
			},
			async ensureOnline() {
				return new Promise((resolve) => {
					uni.getNetworkType({
						success: (res) => resolve(res.networkType !== 'none'),
						fail: () => resolve(true)
					})
				})
			},
			async uploadAvatarFile(filePath, extname) {
				const online = await this.ensureOnline()
				if (!online) {
					uni.showToast({ title: '当前功能需要联网', icon: 'none' })
					return null
				}
				const avatar_file = {
					extname,
					name: '',
					url: ''
				}
				const cloudPath = `${this.userInfo._id || 'avatar'}${Date.now()}`
				avatar_file.name = cloudPath
				uni.showLoading({
					title: "更新中",
					mask: true
				});
				try {
					const prepared = await prepareLocalImage(filePath, { profile: 'avatar' })
					avatar_file.url = await uploadLocalImage(prepared.path, {
						familyId: this.userInfo._id || 'account',
						collection: 'avatars',
						rowId: this.userInfo._id || 'account',
						index: 0
					})
					this.setAvatarFile(avatar_file)
					return avatar_file
				} catch (e) {
					console.error(e);
					uni.showToast({ title: '头像上传失败', icon: 'none' })
					return null
				} finally {
					uni.hideLoading()
				}
			},
			async bindchooseavatar(res){
				let avatarUrl = res.detail.avatarUrl
				const extname = avatarUrl.split('.')[avatarUrl.split('.').length - 1]
				await this.uploadAvatarFile(avatarUrl, extname)
			},
			uploadAvatarImg(res) {
				// #ifdef MP-WEIXIN
				return false // 微信小程序走 bindchooseavatar方法
				// #endif

				// #ifndef MP-WEIXIN
				if(!this.hasLogin){
					return uni.navigateTo({
						url:'/uni_modules/uni-id-pages/pages/login/login-withoutpwd'
					})
				}
				const crop = {
					quality: 100,
					width: 600,
					height: 600,
					resize: true
				};
				uni.chooseImage({
					count: 1,
					crop,
					success: async (res) => {
						let tempFile = res.tempFiles[0],
							avatar_file = {
								// #ifdef H5
								extname: tempFile.name.split('.')[tempFile.name.split('.').length - 1],
								// #endif
								// #ifndef H5
								extname: tempFile.path.split('.')[tempFile.path.split('.').length - 1]
								// #endif
							},
							filePath = res.tempFilePaths[0]

						//非app端剪裁头像，app端用内置的原生裁剪
						// #ifdef H5
						if (!this.isPC) {
							filePath = await new Promise((callback) => {
								uni.navigateTo({
									url: '/uni_modules/uni-id-pages/pages/userinfo/cropImage/cropImage?path=' +
										filePath + `&options=${JSON.stringify(crop)}`,
									animationType: "fade-in",
									events: {
										success: url => {
											callback(url)
										}
									},
									complete(e) {
										console.log(e);
									}
								});
							})
						}
						// #endif

						await this.uploadAvatarFile(filePath, avatar_file.extname)
					}
				})
				// #endif
			}
		}
	}
</script>

<style>
	/* #ifndef APP-NVUE */
	.box{
		overflow: hidden;
	}
	/* #endif */
	.box{
		padding: 0;
	}

	.chooseAvatar {
		/* #ifndef APP-NVUE */
		display: inline-block;
		box-sizing: border-box;
		/* #endif */
		border-radius: 10px;
		text-align: center;
		padding: 1px;
	}
	.showBorder{
		border: solid 1px #ddd;
	}
</style>
