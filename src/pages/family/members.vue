<template>
  <view class="page">
    <!-- 顶栏 -->
    <BPageHeader title="家庭管理" />

    <!-- 空状态 -->
    <BEmpty
      v-if="memberList.length === 0"
      icon="group"
      title="暂无成员"
      description="邀请家人一起管理犬舍"
      actionText="邀请成员"
      @action="goToInvite"
    />

    <template v-else>
      <!-- 犬舍信息卡 -->
      <view class="info-card">
        <view class="info-row" @click="editFamilyName">
          <text class="info-row-label">犬舍名称</text>
          <view class="info-row-value" style="display: flex; align-items: center; gap: 6px;">
            <text>{{ familyName || '未设置' }}</text>
            <text class="material-icons-round" style="font-size: 16px; color: var(--text-3);">edit</text>
          </view>
        </view>
        <view class="info-row">
          <text class="info-row-label">创建日期</text>
          <text class="info-row-value">{{ createdDate }}</text>
        </view>
      </view>

      <!-- 成员区头部 -->
      <view class="section-header">
        <text class="section-header__title">成员</text>
        <text class="section-header__count">{{ memberList.length }}人</text>
      </view>

      <!-- 成员列表 -->
      <view class="list">
        <view v-for="member in memberList" :key="member.user_id" class="member-card">
          <view class="member-left">
            <view class="member-avatar" :class="`member-avatar--${member.role}`">
              <text class="material-icons-round" style="font-size: 20px; color: #fff;">person</text>
            </view>
            <view class="member-info">
              <text class="member-name">{{ member.nickname || member.user_id }}</text>
              <BTag :label="roleLabel(member.role)" :color="roleColor(member.role)" />
            </view>
          </view>

          <view v-if="member.role !== 'creator'" class="member-actions">
            <view class="action-btn" @click="changeRole(member)">
              <text class="material-icons-round" style="font-size: 18px; color: var(--blue);">swap_horiz</text>
            </view>
            <view class="action-btn action-btn--danger" @click="remove(member)">
              <text class="material-icons-round" style="font-size: 18px;">person_remove</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 底部邀请按钮 -->
      <view class="action-area">
        <BSubmitButton @click="goToInvite">
          <text class="material-icons-round" style="font-size: 18px; margin-right: 6px;">person_add</text>
          <text>邀请新成员</text>
        </BSubmitButton>
      </view>
      <text class="hint-text">生成邀请链接，对方点击后加入犬舍</text>
    </template>

    <!-- 修改犬舍名称弹窗 -->
    <BModal
      v-model:visible="showNameModal"
      title="修改犬舍名称"
      @confirm="onNameConfirm"
    >
      <view class="custom-input-wrap">
        <input
          v-model="nameInput"
          class="custom-input"
          placeholder="请输入犬舍名称"
        />
      </view>
    </BModal>

    <BModal
      v-model:visible="showConfirmModal"
      :title="confirmTitle"
      :content="confirmContent"
      :confirmText="confirmText"
      :danger="confirmDanger"
      @confirm="handleConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useCloudCall } from '@/composables/useCloudCall'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BTag from '@/components/base/BTag.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BModal from '@/components/layout/BModal.vue'

const { currentFamily, loadFamily } = useAuth()

const memberList = computed(() =>
  (currentFamily.value?.members || []).filter(m => m.status === 'active')
)
const familyName = computed(() => currentFamily.value?.name || '')
const createdDate = computed(() => formatDate(currentFamily.value?.created_at))

const showNameModal = ref(false)
const nameInput = ref('')
const showConfirmModal = ref(false)
const confirmTitle = ref('')
const confirmContent = ref('')
const confirmText = ref('确定')
const confirmDanger = ref(false)
let confirmAction: (() => Promise<void>) | null = null

const { run: updateRole } = useCloudCall('family-service', 'updateMemberRole', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: removeMember } = useCloudCall('family-service', 'removeMember', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: doUpdateFamilyName } = useCloudCall('family-service', 'updateFamilyName', { successMode: 'silent', loadingMode: 'local', throwOnError: true })

function roleLabel(role: string) {
  const labels: Record<string, string> = { creator: '创建者', admin: '管理员', helper: '协助者' }
  return labels[role] || role
}

function roleColor(role: string) {
  const map: Record<string, any> = { creator: 'amber', admin: 'blue', helper: 'green' }
  return map[role] || 'green'
}

function formatDate(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function editFamilyName() {
  nameInput.value = familyName.value
  showNameModal.value = true
}

async function onNameConfirm() {
  if (nameInput.value.trim()) {
    await doUpdateFamilyName(nameInput.value.trim())
    await loadFamily()
  }
}

async function changeRole(member: any) {
  const newRole = member.role === 'admin' ? 'helper' : 'admin'
  const label = newRole === 'admin' ? '管理员' : '协助者'
  confirmTitle.value = '更改角色'
  confirmContent.value = `将该成员设为${label}？`
  confirmText.value = '确认更改'
  confirmDanger.value = false
  confirmAction = async () => {
    await updateRole(member.user_id, newRole)
    await loadFamily()
  }
  showConfirmModal.value = true
}

async function remove(member: any) {
  confirmTitle.value = '确认移除'
  confirmContent.value = '移除后该成员将无法访问家庭数据'
  confirmText.value = '确认移除'
  confirmDanger.value = true
  confirmAction = async () => {
    await removeMember(member.user_id)
    await loadFamily()
  }
  showConfirmModal.value = true
}

async function handleConfirm() {
  if (confirmAction) {
    await confirmAction()
  }
}

function goToInvite() {
  uni.navigateTo({ url: '/pages/family/invite' })
}
</script>

<style lang="scss" scoped>
/* 犬舍信息卡 */
.info-card {
  margin: 0 var(--space-page) 16px;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 4px 16px;
  box-shadow: var(--shadow);
}

/* 区域头部 */
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px var(--space-page) 10px;

  &__title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-2);
    letter-spacing: 0.5px;
  }

  &__count {
    font-size: 11px;
    font-weight: 700;
    color: var(--primary);
    background: var(--primary-soft);
    padding: 2px 8px;
    border-radius: 10px;
  }
}

/* 提示文字 */
.hint-text {
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
  padding: 0 var(--space-page);
}

/* 成员列表 */
.list {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: var(--space-group-gap);
}

.member-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  box-shadow: var(--shadow);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.member-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.member-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &--creator {
    background: linear-gradient(135deg, var(--primary), var(--amber));
  }

  &--admin {
    background: var(--blue);
  }

  &--helper {
    background: var(--green);
  }
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.member-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--card-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
  color: var(--text-2);

  &:active {
    transform: scale(0.85);
  }

  &--danger {
    &:active {
      color: var(--red);
      background: var(--red-soft);
    }
  }
}
</style>
