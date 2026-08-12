<script setup lang="ts">
const ui = useUiStore()

const icons: Record<ToastItem['type'], string> = {
  success: 'icon-[ph--check-circle] text-emerald-500',
  error: 'icon-[ph--warning-circle] text-rose-500',
  info: 'icon-[ph--info] text-indigo-500',
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex w-72 flex-col gap-2">
    <TransitionGroup name="toast">
      <div
        v-for="item in ui.toasts"
        :key="item.id"
        class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 text-sm shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
      >
        <span class="shrink-0 text-lg" :class="icons[item.type]" />
        <span class="flex-1 break-words">{{ item.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>
