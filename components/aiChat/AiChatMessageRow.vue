<script setup lang="ts">
import type { ChatMessage } from '@/types/aiChat'
import type { Library, WardrobeClothes } from '@/types/api'

defineProps<{
	msg: ChatMessage
	pickingSimilarPair: { messageId: string; libraryId: number } | null
	openingCustomClothes: boolean
	similarShowMax: number
}>()

const emit = defineEmits<{
	pickSimilar: [messageId: string, lib: Library]
	joinWardrobe: [
		source: 'library' | 'shared',
		item: Library | WardrobeClothes,
		ev?: MouseEvent
	]
	openEcho: [clothesId: number]
	openWardrobe: [item: WardrobeClothes]
	addTailPlan: [item: WardrobeClothes, ev: MouseEvent]
	openPlanPage: []
	customAdd: [ev: MouseEvent]
	continue: []
}>()

function onEchoAddTailPlan(item: WardrobeClothes, ev: MouseEvent) {
	emit('addTailPlan', item, ev)
}

function onPickSimilar(mid: string, lib: Library) {
	emit('pickSimilar', mid, lib)
}

function onJoinWardrobe(
	s: 'library' | 'shared',
	item: Library | WardrobeClothes,
	ev?: MouseEvent
) {
	emit('joinWardrobe', s, item, ev)
}
</script>

<template>
  <div class="flex w-full min-w-0" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
    <AiChatMsgUser v-if="msg.role === 'user'" :text="msg.text" />
    <AiChatMsgEchoClothes
      v-else-if="msg.role === 'assistant' && msg.echoClothes"
      :intent-hint="msg.intentHint"
      :echo-clothes="msg.echoClothes"
      :tail-plan-added="msg.tailPlanAdded"
      @open-echo="emit('openEcho', $event)"
      @open-wardrobe="emit('openWardrobe', $event)"
      @add-tail-plan="onEchoAddTailPlan"
      @continue="emit('continue')" />
    <AiChatMsgEchoPlan
      v-else-if="msg.role === 'assistant' && msg.echoPlan"
      :intent-hint="msg.intentHint"
      :echo-plan="msg.echoPlan"
      @open-plan-page="emit('openPlanPage')"
      @continue="emit('continue')" />
    <AiChatMsgSimilar
      v-else-if="msg.role === 'assistant' && msg.similarItems !== undefined && !msg.analysis"
      :intent-hint="msg.intentHint"
      :similar-items="msg.similarItems"
      :show-max="similarShowMax" />
    <AiChatMsgStream
      v-else-if="msg.role === 'assistant' && msg.intentStreaming && !msg.analysis"
      :reasoning="msg.intentStreamReasoning"
      :content="msg.intentStreamContent" />
    <AiChatMsgAnalysis
      v-else-if="msg.role === 'assistant' && msg.analysis"
      :msg="msg"
      :picking-similar-pair="pickingSimilarPair"
      :opening-custom-clothes="openingCustomClothes"
      @pick-similar="onPickSimilar"
      @join-wardrobe="onJoinWardrobe"
      @custom-add="emit('customAdd', $event)" />
    <AiChatMsgError v-else-if="msg.error" :error="msg.error" />
  </div>
</template>
