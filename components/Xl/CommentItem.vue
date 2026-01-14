<script setup lang="ts">
    import SafeRichText from '@/components/SafeRichText.vue'
    import type { RichNode } from '@/utils/public'
    
    // 定义单条评论的数据结构
    interface Comment {
      id: number | string
      username: string
      avatar: string
      content: string
      richContent?: RichNode[] // 富文本内容
      time: string
      location?: string // 新增 IP 属地
      likes?: number    // 新增 点赞数
    }
    
    defineProps<{
      comment: Comment
    }>()
    </script>
    
    <template>
      <div class="flex gap-3 mb-6">
        <UAvatar 
          :src="comment.avatar" 
          :alt="comment.username" 
          size="sm" 
          class="mt-0.5 flex-shrink-0"
        />
        
        <div class="flex-1">
          <div class="text-[13px] text-gray-500 font-medium leading-none">
            {{ comment.username }}
          </div>
          
          <div class="text-[15px] text-gray-900 mt-1.5 leading-normal text-justify">
            <SafeRichText v-if="comment.richContent" :nodes="comment.richContent" />
            <span v-else>{{ comment.content }}</span>
          </div>
          
          <div class="mt-2 flex items-center gap-3 text-xs text-gray-400">
            <span>{{ comment.time }}</span>
            <span v-if="comment.location">{{ comment.location }}</span>
            
            <button class="font-medium text-gray-500 hover:text-blue-600 transition-colors">
              回复
            </button>
          </div>
        </div>
        
        <div class="flex flex-col items-center gap-1 mt-1 text-gray-400">
          <UIcon name="i-heroicons-heart" class="w-4 h-4" />
          <span v-if="comment.likes" class="text-[10px]">{{ comment.likes }}</span>
        </div>
      </div>
    </template>