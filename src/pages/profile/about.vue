<template>
  <view class="page">
    <BPageHeader title="关于" />

    <view class="about-card">
      <!-- App 图标 -->
      <view class="about-card__icon">
        <text class="material-icons-round" style="font-size: 40px; color: #fff;">pets</text>
      </view>
      <text class="about-card__name">宠物繁育管理</text>
      <text class="about-card__version">v1.0.0</text>

      <view class="about-card__divider" />

      <view class="about-info">
        <view class="about-row">
          <text class="about-row__label">开发者</text>
          <text class="about-row__value">Breed App Team</text>
        </view>
        <view class="about-row">
          <text class="about-row__label">技术栈</text>
          <text class="about-row__value">UniApp + UniCloud</text>
        </view>
        <view class="about-row">
          <text class="about-row__label">数据库</text>
          <text class="about-row__value">MongoDB (支付宝云)</text>
        </view>
      </view>

      <view class="about-card__divider" />

      <text class="about-card__footer">
        专为马尔济斯犬繁育者打造的管理工具
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import BPageHeader from '@/components/layout/BPageHeader.vue'
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

.about-card {
  margin: 0 16px;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 32px 24px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  align-items: center;

  &__icon {
    width: 80px;
    height: 80px;
    border-radius: 20px;
    background: linear-gradient(135deg, var(--primary), var(--amber));
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    box-shadow: 0 4px 16px rgba(234, 62, 119, 0.25);
  }

  &__name {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 800;
    color: var(--text-1);
    margin-bottom: 4px;
  }

  &__version {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-3);
    padding: 2px 10px;
    border-radius: var(--radius-tag);
    background: var(--card-dim);
  }

  &__divider {
    width: 100%;
    height: 1px;
    background: var(--card-dim);
    margin: 20px 0;
  }

  &__footer {
    font-size: 13px;
    color: var(--text-3);
    text-align: center;
    line-height: 1.5;
  }
}

.about-info {
  width: 100%;
}

.about-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;

  &:not(:last-child) { border-bottom: 0.5px solid var(--card-dim); }

  &__label {
    font-size: 14px;
    color: var(--text-3);
  }

  &__value {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
  }
}
</style>
