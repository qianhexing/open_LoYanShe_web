<script setup lang="ts">
import type { Study, StudyForeign } from '@/types/api';
import { getStudyForeignList } from '@/api/study';
interface Props {
  study_id: number,
  className?: string,
  size?: string  // 尺寸 mini small mid big
  needJump?: boolean // 是否需要跳转
  keyName?: number
  isActive?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  needJump: true,
  keyName: 0,
  isActive: true
})
const { size, needJump, study_id, keyName } = props
const handleJump = (ele: StudyForeign) => {
  if (!needJump) {
    return
  }
  if (ele.pk_type === 6) {
    window.open(`${ele.pk_id}`, '_blank')
  }
  // window.open(`/study/detail/${id}`, '_blank')
  // navigateTo(`/shop/detail/${id}`)
}
</script>
<template>
  <div :class="className ? className : 'w-full'">
    <QhxWaterList  :fetch-data="async (page, pageSize) => {
      const response = await getStudyForeignList({ page, pageSize, study_id: study_id })
      return {
        rows: response.rows,
        count: response.count
      }
    }" :columns="3" :itemKey="keyName"  :columns_768="1" :enableWaterfall="isActive" :enableLoadMore="isActive">
      <template #default="{ item, debouncedApplyLayout }">
        <!-- 自定义内容 -->
        <div class="custom-item">
          <div v-if="item.library">
            图鉴类型
            <LibraryItem :item="item.library" @imageLoad="debouncedApplyLayout"></LibraryItem>
          </div>
          <div v-else-if="item.community">
            <CommunityItem :item="item.community" :size="'big'" @imageLoad="debouncedApplyLayout"></CommunityItem>
          </div>
          <div v-else-if="item.foreign">
            <div class="bg-qhx-bg-card polaroid-card cursor-pointer shadow-lg p-2 m-2">
              <div class="w-full flex" @click="handleJump(item)">
                <QhxPreviewImage :list="[{ src: item.foreign.cover || 'static/plan_cover/default.jpg', alt: item.title || 'Lo研社' }]"
                  :preview="[item.foreign.cover || 'static/plan_cover/default.jpg']"
                  :className="'w-[100px] h-[100px] shadow-lg m-1 object-cover aspect-[1/1] rounded-[10px]'">
                </QhxPreviewImage>
                <div class="ml-2 flex-1">
                  <SafeRichText v-if="item.foreign.text" :nodes="parseRichText(item.foreign.text)"></SafeRichText>
                </div>
              </div>
            </div>
          </div>
          <div v-else>
            没有找到的类型
          </div>
        </div>
      </template>
    </QhxWaterList>
  </div>
</template>

<style scoped></style>