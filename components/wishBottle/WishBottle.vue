<script setup lang="ts">
import type { UserDeco } from '@/types/api'
import type { BadgePhysicsMotionPreset } from '@/components/achievement/BadgePhysics.client.vue'

const props = withDefaults(
  defineProps<{
    badges: UserDeco[]
    /** 徽章加载完成（用于区分空瓶与加载中） */
    loaded?: boolean
  }>(),
  { loaded: true },
)

const motionPreset = ref<BadgePhysicsMotionPreset>('gravity')

const motionHint = computed(() =>
  motionPreset.value === 'gravity' ? '切换为碰壁回弹' : '切换为重力掉落',
)

function toggleMotionPreset() {
  motionPreset.value =
    motionPreset.value === 'gravity' ? 'wallBounce' : 'gravity'
}

const badgesKey = computed(
  () =>
    `${motionPreset.value}:${
      props.badges.length
        ? props.badges.map((b) => b.deco_id).join(',')
        : 'empty'
    }`,
)

const hasBadges = computed(() => props.badges.length > 0)
</script>

<template>
  <div class="wish-bottle-wrap">
    <div class="wish-bottle" aria-label="许愿瓶">
      <!-- 瓶身填充区：徽章物理层，裁切为瓶身内腔 -->
      <div class="wish-bottle__cavity">
        <ClientOnly>
          <AchievementBadgePhysics
            v-if="hasBadges"
            :key="badgesKey"
            :badges="badges"
            :scale="2.4"
            :collider-scale="1.4"
            :floor-inset="1"
            :side-inset="0.7"
            :motion-preset="motionPreset"
          />
          <div
            v-else-if="loaded"
            class="wish-bottle__empty"
          >
            <p class="wish-bottle__empty-text">暂无展示徽章</p>
            <p class="wish-bottle__empty-hint">去用户空间配置徽章吧</p>
          </div>
          <div
            v-else
            class="wish-bottle__loading"
          >
            <UIcon
              name="i-heroicons-arrow-path"
              class="h-8 w-8 animate-spin text-rose-400/80"
            />
          </div>
        </ClientOnly>
      </div>

      <!-- 最前层：半透明玻璃瓶 -->
      <svg
        class="wish-bottle__glass"
        viewBox="0 0 200 360"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
      <defs>
        <linearGradient id="wishBottleGlass" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.55)" />
          <stop offset="18%" stop-color="rgba(255,255,255,0.12)" />
          <stop offset="45%" stop-color="rgba(186,230,253,0.18)" />
          <stop offset="72%" stop-color="rgba(255,255,255,0.08)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.42)" />
        </linearGradient>
        <linearGradient id="wishBottleRim" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.7)" />
          <stop offset="100%" stop-color="rgba(251,207,232,0.35)" />
        </linearGradient>
        <linearGradient id="wishBottleCork" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#e8c9a0" />
          <stop offset="100%" stop-color="#c4a06a" />
        </linearGradient>
        <radialGradient id="wishBottleGlow" cx="50%" cy="70%" r="45%">
          <stop offset="0%" stop-color="rgba(251,207,232,0.25)" />
          <stop offset="100%" stop-color="rgba(251,207,232,0)" />
        </radialGradient>
      </defs>

      <!-- 瓶内柔光（衬在玻璃下，但 SVG 整体在徽章之上，用低透明） -->
      <ellipse
        cx="100"
        cy="250"
        rx="70"
        ry="90"
        fill="url(#wishBottleGlow)"
        opacity="0.9"
      />

      <!-- 瓶身玻璃壳：肩部收窄，瓶底偏方 -->
      <path
        class="wish-bottle__shell"
        d="M78 72
           C78 64 84 58 100 58
           C116 58 122 64 122 72
           L128 96
           C148 116 158 145 158 180
           L158 318
           C158 332 148 342 132 342
           L68 342
           C52 342 42 332 42 318
           L42 180
           C42 145 52 116 72 96
           Z"
        fill="url(#wishBottleGlass)"
        stroke="rgba(255,255,255,0.65)"
        stroke-width="1.5"
      />

      <!-- 瓶口内圈 -->
      <ellipse
        cx="100"
        cy="58"
        rx="22"
        ry="8"
        fill="url(#wishBottleRim)"
        stroke="rgba(255,255,255,0.5)"
        stroke-width="1"
      />

      <!-- 软木塞 -->
      <rect
        x="82"
        y="28"
        width="36"
        height="32"
        rx="6"
        fill="url(#wishBottleCork)"
        stroke="rgba(139,105,60,0.35)"
        stroke-width="1"
      />
      <ellipse
        cx="100"
        cy="28"
        rx="18"
        ry="6"
        fill="#f0d7b0"
      />
      <!-- 塞子纹理 -->
      <path
        d="M88 40 Q100 36 112 40"
        fill="none"
        stroke="rgba(139,105,60,0.25)"
        stroke-width="1.2"
      />
      <path
        d="M88 48 Q100 44 112 48"
        fill="none"
        stroke="rgba(139,105,60,0.2)"
        stroke-width="1.2"
      />

      <!-- 左侧高光 -->
      <path
        d="M58 160
           C54 200 54 250 58 290
           C62 300 68 305 74 298
           C68 250 68 200 72 165
           C68 155 62 152 58 160 Z"
        fill="rgba(255,255,255,0.35)"
      />
      <!-- 右侧细高光 -->
      <path
        d="M142 170
           C144 210 144 255 140 295
           C136 300 132 298 130 292
           C134 250 134 210 132 175
           C134 168 140 166 142 170 Z"
        fill="rgba(255,255,255,0.18)"
      />

      <!-- 瓶肩折射线 -->
      <path
        d="M74 105 Q100 118 126 105"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        stroke-width="1.2"
        stroke-linecap="round"
      />
    </svg>
    </div>

    <button
      v-if="hasBadges"
      type="button"
      class="wish-bottle__mode-btn"
      :title="motionHint"
      :aria-label="motionHint"
      @click="toggleMotionPreset"
    >
      <span class="wish-bottle__mode-seg" :data-active="motionPreset === 'gravity'">掉落</span>
      <span class="wish-bottle__mode-seg" :data-active="motionPreset === 'wallBounce'">碰壁</span>
    </button>
  </div>
</template>

<style scoped>
.wish-bottle-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.wish-bottle {
  --bottle-w: min(85vw, 420px);
  position: relative;
  width: var(--bottle-w);
  aspect-ratio: 200 / 360;
  margin-inline: auto;
  filter: drop-shadow(0 18px 40px rgba(190, 120, 150, 0.28));
}

.wish-bottle__mode-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem;
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 8px 24px rgba(190, 120, 150, 0.18);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease;
}

.wish-bottle__mode-btn:hover {
  background: rgba(255, 255, 255, 0.88);
}

.wish-bottle__mode-btn:active {
  transform: scale(0.97);
}

.wish-bottle__mode-seg {
  min-width: 3.5rem;
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: rgba(170, 110, 130, 0.7);
  transition: background 0.2s ease, color 0.2s ease;
}

.wish-bottle__mode-seg[data-active='true'] {
  background: #e8799a;
  color: #fff;
  box-shadow: 0 4px 12px rgba(232, 121, 154, 0.35);
}

:global(.dark) .wish-bottle__mode-btn {
  background: rgba(40, 28, 34, 0.75);
  border-color: rgba(255, 255, 255, 0.12);
}

:global(.dark) .wish-bottle__mode-seg {
  color: rgba(230, 180, 195, 0.65);
}

:global(.dark) .wish-bottle__mode-seg[data-active='true'] {
  background: #d96588;
  color: #fff;
}

.wish-bottle__cavity {
  position: absolute;
  /* 内缩一圈，避免徽章贴边被瓶壁裁切遮挡 */
  left: 22%;
  right: 22%;
  top: 30%;
  bottom: 8%;
  z-index: 1;
  overflow: hidden;
  /* 瓶身轮廓：窄颈 → 肩 → 偏方底 */
  clip-path: polygon(
    40% 0%,
    60% 0%,
    66% 7%,
    86% 20%,
    94% 38%,
    94% 90%,
    88% 100%,
    12% 100%,
    6% 90%,
    6% 38%,
    14% 20%,
    34% 7%
  );
  background:
    linear-gradient(
      180deg,
      rgba(255, 240, 245, 0.15) 0%,
      rgba(255, 228, 236, 0.08) 40%,
      rgba(186, 230, 253, 0.12) 100%
    );
}

.wish-bottle__cavity :deep(.badge-3d-container) {
  width: 100%;
  height: 100%;
}

.wish-bottle__glass {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.wish-bottle__shell {
  mix-blend-mode: soft-light;
}

.wish-bottle__empty,
.wish-bottle__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 1rem;
  text-align: center;
}

.wish-bottle__empty-text {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(190, 120, 140, 0.85);
}

.wish-bottle__empty-hint {
  margin: 0.35rem 0 0;
  font-size: 0.7rem;
  color: rgba(160, 130, 140, 0.7);
}
</style>
