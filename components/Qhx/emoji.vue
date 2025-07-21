<template>
  <div style="display: inline-block;">
    <img v-if="url" style="width: 50px; height: 50px;" :src="BASE_IMG + url" />
  </div>
</template>

<script setup>
const props = defineProps({
  id: {
    type: Number
  }
})

const url = ref(null)
const configStore = useConfigStore()

const emojiPath = (id) => {
  return new URL(`./emoji/${id}.png`, import.meta.url).href
}
watch(configStore, (newVal) => {
  if (newVal) matchEmoji()
})

const matchEmoji = () => {
  const config = configStore.config
  if (!config) {
    return
  }
  if (config.emoji_config && props.id !== undefined) {
    // biome-ignore lint/complexity/noForEach: <explanation>
    config.emoji_config.forEach((child) => {
      const index = child.list.findIndex((emoji) => {
        return emoji.value === props.id
      })
      console.log(index, 'emoji', props.id)
      if (index !== -1) {
        url.value = child.list[index].url
      }
    })
  }
}

onMounted(() => {
  matchEmoji()
})
</script>

<style scoped>
.info-button-list {
  background: #ffaa7f;
  display: inline-block;
  color: #fff;
  border-radius: 50%;
  margin: 0 5px;
  width: 25px;
  height: 25px;
  text-align: center;
  line-height: 25px;
}

.clothes-list {
  display: flex;
  flex-wrap: wrap;
}

.clothes-list-box {
  width: calc(100% / 5);
}

.clothes-note {
  margin: 5px;
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  text-align: center;
}

.clothes-img {
  width: 100rpx;
  margin: 10rpx;
  box-shadow: 1px 1px 10px #ccc;
  border-radius: 5px;
  overflow: hidden;
}

.clothes-img img {
  width: 100rpx;
}
</style>