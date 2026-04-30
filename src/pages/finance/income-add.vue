<template>
  <view class="income-add-redirect" />
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { usePageSync } from '@/composables/usePageSync'

usePageSync({ routePath: 'pages/finance/income-add' })

function buildRedirectUrl(query: Record<string, any>) {
  const nextQuery = new URLSearchParams()
  nextQuery.set('type', 'income')

  Object.entries(query || {}).forEach(([key, value]) => {
    if (key === 'type' || value === undefined || value === null || value === '') return
    nextQuery.set(key, String(value))
  })

  return `/pages/finance/expense-add?${nextQuery.toString()}`
}

onLoad((query) => {
  const url = buildRedirectUrl((query || {}) as Record<string, any>)
  uni.redirectTo({
    url,
    fail() {
      uni.navigateTo({ url })
    },
  })
})
</script>

<style lang="scss" scoped>
.income-add-redirect {
  min-height: 100vh;
}
</style>

.form-right {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-1);
  font-weight: 500;
}

/* ---- Category tag ---- */
.category-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--card-dim);
  border-radius: 14px;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

/* ---- Photo row ---- */
.photo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  font-size: 14px;
  color: var(--text-3);
  font-weight: 500;

  .material-icons-round {
    font-size: 20px;
    color: var(--text-3);
  }
}

/* ---- Photo preview ---- */
.photo-preview-row {
  display: flex;
  gap: 8px;
  padding: 10px 0 4px;
  flex-wrap: wrap;
}

.photo-thumb-wrap {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 10px;
  overflow: hidden;
}

.photo-thumb {
  width: 100%;
  height: 100%;
}

.photo-thumb-del {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ---- Note section ---- */
.note-section {
  padding: 14px 0 4px;
}

.note-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 10px;
}

.note-textarea {
  width: 100%;
  min-height: 72px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  font-family: var(--font-body);
  color: var(--text-1);
  background: var(--card);
  resize: none;
  outline: none;

  &::placeholder {
    color: var(--text-4);
  }
}

</style>
