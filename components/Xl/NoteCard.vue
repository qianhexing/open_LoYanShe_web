<script setup lang="ts">
    // 定义清晰的接口
    interface NoteItem {
      id: string | number
      cover: string
      title: string
      user: {
        avatar: string
        name: string
      }
      likes: number
    }
    
    // 引用接口
    defineProps<{
      note: NoteItem
    }>()
    
    const router = useRouter()
    const goDetail = (id: string | number) => {
      // 确保跳转路径对齐
      router.push(`/post/${id}`)
    }
    </script>

<template>
    <div class="group cursor-pointer break-inside-avoid mb-4" @click="goDetail(note.id)">
        <div class="relative overflow-hidden rounded-xl bg-gray-100">
            <img :src="note.cover" alt="cover"
                class="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy" />
            <div class="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <h3 class="mt-2 text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
            {{ note.title }}
        </h3>

        <div class="mt-2 flex items-center justify-between">
            <div class="flex items-center gap-2 overflow-hidden">
                <UAvatar :src="note.user.avatar" :alt="note.user.name" size="2xs" />
                <span class="text-xs text-gray-500 truncate">{{ note.user.name }}</span>
            </div>

            <div class="flex items-center gap-1 text-gray-500">
                <UIcon name="i-heroicons-heart" class="w-4 h-4" />
                <span class="text-xs">{{ note.likes }}</span>
            </div>
        </div>
    </div>
</template>