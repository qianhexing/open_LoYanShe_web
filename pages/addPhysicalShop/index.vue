<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
    <div v-if="loading" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="text-white text-lg">{{ t('addPhysicalShop.loading') }}</div>
    </div>

    <div class="container mx-auto px-4 max-w-4xl">
      <UAlert
        color="yellow"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        class="mb-6"
      >
        <template #title>
          {{ t('addPhysicalShop.notice_title') }}
        </template>
        <template #description>
          {{ t('addPhysicalShop.notice_desc') }}
        </template>
      </UAlert>

      <div v-if="user && user.access_level >= (config?.min_add_library || 0)">
        <UForm ref="formRef" :state="form" class="space-y-6 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <UFormGroup :label="t('addPhysicalShop.shop_id')" name="shop_id" required>
            <USelectMenu
              v-model="selectedShop"
              :loading="shopOptionsLoading"
              :searchable="fetchShopOptions"
              :placeholder="t('addPhysicalShop.search_shop_placeholder')"
              option-attribute="shop_name"
              :multiple="false"
              trailing
              by="shop_id"
              class="w-full"
              :disabled="!!physicalId"
              :ui="inputUi"
            />
          </UFormGroup>

          <UFormGroup :label="t('addPhysicalShop.physical_name')" name="physical_name" required>
            <UInput
              v-model="form.physical_name"
              :placeholder="t('addPhysicalShop.physical_name_placeholder')"
              :ui="inputUi"
            />
          </UFormGroup>

          <UFormGroup :label="t('addPhysicalShop.physical_logo')" name="physical_logo">
            <QhxImagePicker
              ref="logoImagePickerRef"
              :multiple="false"
              :max="1"
              @update:files="handleLogoFiles"
            />
            <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('addPhysicalShop.physical_logo_tip') }}
            </div>
          </UFormGroup>

          <UFormGroup :label="t('addPhysicalShop.physical_desc')" name="physical_desc">
            <UTextarea
              v-model="form.physical_desc"
              :placeholder="t('addPhysicalShop.physical_desc_placeholder')"
              :rows="4"
              :ui="textareaUi"
            />
          </UFormGroup>

          <UFormGroup :label="t('addPhysicalShop.address_region')" name="address_region" required>
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <QhxTag v-if="form.province && form.city && form.area" :active="true">
                {{ form.province }} {{ form.city }} {{ form.area }}
                <UIcon
                  name="i-heroicons-x-mark"
                  class="ml-1 text-sm cursor-pointer"
                  @click="deleteAddress"
                />
              </QhxTag>
              <UButton color="primary" size="sm" variant="outline" @click="openAddressPicker">
                {{ form.province ? t('addPhysicalShop.change_address') : t('addPhysicalShop.select_address') }}
              </UButton>
            </div>
          </UFormGroup>

          <UFormGroup :label="t('addPhysicalShop.address_detail')" name="address" required>
            <UInput
              v-model="form.address"
              :placeholder="t('addPhysicalShop.address_detail_placeholder')"
              :ui="inputUi"
            />
          </UFormGroup>

          <UFormGroup :label="t('addPhysicalShop.coordinates')" name="coordinates">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UInput
                v-model="latitudeModel"
                type="number"
                :placeholder="t('addPhysicalShop.latitude_placeholder')"
                :ui="inputUi"
              />
              <UInput
                v-model="longitudeModel"
                type="number"
                :placeholder="t('addPhysicalShop.longitude_placeholder')"
                :ui="inputUi"
              />
            </div>
            <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {{ t('addPhysicalShop.coordinates_tip') }}
              <a
                href="https://lbs.baidu.com/maptool/getpoint"
                target="_blank"
                rel="noopener noreferrer"
                class="text-qhx-primary hover:underline ml-1"
              >
                {{ t('addPhysicalShop.get_coordinates') }}
              </a>
            </div>
          </UFormGroup>

          <div class="flex justify-center pt-4">
            <UButton
              color="primary"
              size="lg"
              :loading="submitting"
              class="w-full md:w-auto px-8"
              @click="handleSubmit"
            >
              {{ physicalId ? t('addPhysicalShop.update_physical_shop') : t('addPhysicalShop.add_physical_shop') }}
            </UButton>
          </div>
        </UForm>
      </div>

      <div v-else class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <UAlert color="yellow" variant="soft" icon="i-heroicons-exclamation-triangle" class="mb-4">
          <template #title>
            {{ t('addPhysicalShop.no_permission') }}
          </template>
          <template #description>
            {{ t('addPhysicalShop.no_permission_desc') }}
          </template>
        </UAlert>
        <div class="flex justify-center">
          <NuxtLink to="/pages/user/invite/index">
            <UButton color="primary" variant="outline">
              {{ t('addPhysicalShop.become_member') }}
            </UButton>
          </NuxtLink>
        </div>
      </div>
    </div>

    <QhxModal v-model="showAddressPicker">
      <div class="w-[90vw] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-700/50">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold">{{ t('addPhysicalShop.select_address_modal') }}</h3>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="showAddressPicker = false"
          >
            <UIcon name="i-heroicons-x-mark" class="text-gray-500" />
          </button>
        </div>
        <div class="p-6 space-y-4">
          <UFormGroup :label="t('addPhysicalShop.province')">
            <UButton variant="outline" block class="justify-start" @click="openProvincePicker">
              {{ selectedProvince?.label || t('addPhysicalShop.select_province') }}
            </UButton>
            <QhxSelect ref="provinceSelectRef" :options="provinceOptions" @select="onProvinceSelect" />
          </UFormGroup>
          <UFormGroup v-if="selectedProvince" :label="t('addPhysicalShop.city')">
            <UButton variant="outline" block class="justify-start" @click="openCityPicker">
              {{ selectedCity?.label || t('addPhysicalShop.select_city') }}
            </UButton>
            <QhxSelect ref="citySelectRef" :options="cityOptions" @select="onCitySelect" />
          </UFormGroup>
          <UFormGroup v-if="selectedCity" :label="t('addPhysicalShop.area')">
            <UButton variant="outline" block class="justify-start" @click="openAreaPicker">
              {{ selectedArea?.label || t('addPhysicalShop.select_area') }}
            </UButton>
            <QhxSelect ref="areaSelectRef" :options="areaOptions" @select="onAreaSelect" />
          </UFormGroup>
          <div class="flex gap-2 justify-end mt-4">
            <UButton color="gray" variant="ghost" @click="showAddressPicker = false">
              {{ t('addPhysicalShop.cancel') }}
            </UButton>
            <UButton color="primary" @click="confirmAddress">
              {{ t('addPhysicalShop.confirm') }}
            </UButton>
          </div>
        </div>
      </div>
    </QhxModal>
  </div>
</template>

<script setup lang="ts">
import addressData from '~/public/address.json'
import {
  getShopOptiosns,
  getShopById,
  getPhysicalShopById,
  insertPhysicalShop,
  updatePhysicalShop
} from '@/api/shop'
import { uploadImageOSS } from '@/utils/ossUpload'
import { BASE_IMG } from '@/utils/ipConfig'
import type QhxImagePicker from '@/components/Qhx/ImagePicker.vue'
import type { default as QhxSelect } from '@/components/Qhx/Select.vue'
import type { Shop } from '@/types/api'

definePageMeta({
  ssr: false
})

interface AddressItem {
  label: string
  value: string
  children?: AddressItem[]
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const userStore = useUserStore()
const configStore = useConfigStore()

const user = computed(() => userStore.user)
const config = computed(() => configStore.config)

const loading = ref(false)
const submitting = ref(false)
const physicalId = ref<number | null>(null)
const shopOptionsLoading = ref(false)
const logoImagePickerRef = ref<InstanceType<typeof QhxImagePicker> | null>(null)
const logoFiles = ref<File[]>([])
const selectedShop = ref<Shop | null>(null)

const form = reactive({
  physical_name: '',
  physical_desc: '',
  physical_logo: '' as string,
  province: '',
  city: '',
  area: '',
  address: '',
  latitude: null as number | null,
  longitude: null as number | null
})

const inputUi = {
  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
  rounded: 'rounded-full',
  padding: { xs: 'px-4 py-2' },
  color: {
    white: {
      outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
    }
  }
}

const textareaUi = {
  base: 'focus:ring-2 focus:ring-qhx-primary focus:border-qhx-primary',
  rounded: 'rounded-lg',
  padding: { xs: 'px-4 py-2' },
  color: {
    white: {
      outline: 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-qhx-primary'
    }
  }
}

const latitudeModel = computed({
  get: () => form.latitude ?? '',
  set: (val: string | number) => {
    const num = Number(val)
    form.latitude = val === '' || !Number.isFinite(num) ? null : num
  }
})

const longitudeModel = computed({
  get: () => form.longitude ?? '',
  set: (val: string | number) => {
    const num = Number(val)
    form.longitude = val === '' || !Number.isFinite(num) ? null : num
  }
})

const showAddressPicker = ref(false)
const selectedProvince = ref<{ label: string; value: string } | null>(null)
const selectedCity = ref<{ label: string; value: string } | null>(null)
const selectedArea = ref<{ label: string; value: string } | null>(null)
const provinceSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const citySelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)
const areaSelectRef = ref<InstanceType<typeof QhxSelect> | null>(null)

const provinceOptions = computed(() =>
  (addressData as AddressItem[]).map(item => ({ label: item.label, value: item.value }))
)

const cityOptions = computed(() => {
  if (!selectedProvince.value) return []
  const province = (addressData as AddressItem[]).find(p => p.value === selectedProvince.value?.value)
  return province?.children?.map(item => ({ label: item.label, value: item.value })) ?? []
})

const areaOptions = computed(() => {
  if (!selectedCity.value || !selectedProvince.value) return []
  const province = (addressData as AddressItem[]).find(p => p.value === selectedProvince.value?.value)
  const city = province?.children?.find(c => c.value === selectedCity.value?.value)
  return city?.children?.map(item => ({ label: item.label, value: item.value })) ?? []
})

const fetchShopOptions = async (keywords: string) => {
  shopOptionsLoading.value = true
  try {
    const params: { shop_name?: string } = {}
    if (keywords.trim()) params.shop_name = keywords.trim()
    const response = await getShopOptiosns(params)
    return response.length > 20 ? response.slice(0, 20) : response
  } finally {
    shopOptionsLoading.value = false
  }
}

function handleLogoFiles(files: File[]) {
  logoFiles.value = files
}

function syncAddressPickerFromForm() {
  if (!form.province || !form.city || !form.area) {
    selectedProvince.value = null
    selectedCity.value = null
    selectedArea.value = null
    return
  }
  const province = (addressData as AddressItem[]).find(p => p.label === form.province)
  if (!province) return
  selectedProvince.value = { label: province.label, value: province.value }
  const city = province.children?.find(c => c.label === form.city)
  if (!city) return
  selectedCity.value = { label: city.label, value: city.value }
  const area = city.children?.find(a => a.label === form.area)
  if (area) selectedArea.value = { label: area.label, value: area.value }
}

function openAddressPicker() {
  syncAddressPickerFromForm()
  showAddressPicker.value = true
}

function openProvincePicker(e: MouseEvent) {
  provinceSelectRef.value?.showPicker(e)
}

function openCityPicker(e: MouseEvent) {
  citySelectRef.value?.showPicker(e)
}

function openAreaPicker(e: MouseEvent) {
  areaSelectRef.value?.showPicker(e)
}

function onProvinceSelect(value: { label: string; value: string | number }) {
  selectedProvince.value = { label: value.label, value: String(value.value) }
  selectedCity.value = null
  selectedArea.value = null
}

function onCitySelect(value: { label: string; value: string | number }) {
  selectedCity.value = { label: value.label, value: String(value.value) }
  selectedArea.value = null
}

function onAreaSelect(value: { label: string; value: string | number }) {
  selectedArea.value = { label: value.label, value: String(value.value) }
}

function confirmAddress() {
  if (!selectedProvince.value || !selectedCity.value || !selectedArea.value) {
    toast.add({
      title: t('addPhysicalShop.address_incomplete'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }
  form.province = selectedProvince.value.label
  form.city = selectedCity.value.label
  form.area = selectedArea.value.label
  showAddressPicker.value = false
}

function deleteAddress() {
  form.province = ''
  form.city = ''
  form.area = ''
  selectedProvince.value = null
  selectedCity.value = null
  selectedArea.value = null
}

async function loadShopByQuery(shopId: number) {
  try {
    const shop = await getShopById({ shop_id: shopId })
    selectedShop.value = shop
  } catch (error) {
    console.error('获取店铺信息失败:', error)
  }
}

async function fetchPhysicalDetail(id: number) {
  loading.value = true
  try {
    const res = await getPhysicalShopById({ physical_id: id })
    form.physical_name = res.physical_name || ''
    form.physical_desc = res.physical_desc || ''
    form.physical_logo = res.physical_logo || ''
    form.province = res.province || ''
    form.city = res.city || ''
    form.area = res.area || ''
    form.address = res.address || ''
    form.latitude = res.latitude != null && res.latitude !== '' ? Number(res.latitude) : null
    form.longitude = res.longitude != null && res.longitude !== '' ? Number(res.longitude) : null

    if (res.physical_logo && logoImagePickerRef.value) {
      logoImagePickerRef.value.previewImages = [{
        id: 'existing',
        url: BASE_IMG + res.physical_logo
      }]
    }

    if (res.shop_id) {
      await loadShopByQuery(res.shop_id)
    } else if (res.shop?.shop_id) {
      await loadShopByQuery(res.shop.shop_id)
    }
  } catch (error) {
    console.error('获取实体店详情失败:', error)
    toast.add({
      title: t('addPhysicalShop.fetch_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (!selectedShop.value?.shop_id) {
    toast.add({
      title: t('addPhysicalShop.shop_required'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }

  if (!form.physical_name.trim()) {
    toast.add({
      title: t('addPhysicalShop.name_required'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }

  if (!form.province || !form.city || !form.area) {
    toast.add({
      title: t('addPhysicalShop.region_required'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }

  if (!form.address.trim()) {
    toast.add({
      title: t('addPhysicalShop.address_required'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'yellow'
    })
    return
  }

  submitting.value = true
  try {
    let physicalLogo = form.physical_logo || ''
    const logoPreviews = logoImagePickerRef.value?.previewImages || []

    if (logoFiles.value.length > 0) {
      physicalLogo = await uploadImageOSS({ file: logoFiles.value[0] })
    } else if (logoPreviews.length > 0 && logoPreviews[0].url) {
      const url = logoPreviews[0].url
      if (url.startsWith(BASE_IMG)) {
        physicalLogo = url.replace(BASE_IMG, '')
      } else if (!url.startsWith('http')) {
        physicalLogo = url
      }
    }

    const currentUser = user.value
    if (!currentUser?.user_id) {
      toast.add({
        title: t('addPhysicalShop.no_permission'),
        icon: 'i-heroicons-exclamation-circle',
        color: 'yellow'
      })
      return
    }

    const params = {
      shop_id: selectedShop.value.shop_id,
      user_id: currentUser.user_id,
      physical_name: form.physical_name.trim(),
      physical_desc: form.physical_desc.trim() || null,
      physical_logo: physicalLogo || null,
      province: form.province,
      city: form.city,
      area: form.area,
      address: form.address.trim(),
      latitude: form.latitude,
      longitude: form.longitude
    }

    if (physicalId.value) {
      await updatePhysicalShop({ ...params, physical_id: physicalId.value })
      toast.add({
        title: t('addPhysicalShop.update_success'),
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    } else {
      await insertPhysicalShop(params)
      toast.add({
        title: t('addPhysicalShop.add_success'),
        icon: 'i-heroicons-check-circle',
        color: 'green'
      })
    }

    setTimeout(() => {
      router.back()
    }, 1000)
  } catch (error) {
    console.error('提交实体店失败:', error)
    toast.add({
      title: t('addPhysicalShop.submit_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'red'
    })
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  const shopIdParam = route.query.shop_id
  if (shopIdParam) {
    await loadShopByQuery(Number.parseInt(shopIdParam as string))
  }

  const physicalIdParam = route.query.physical_id
  if (physicalIdParam && user.value && user.value.access_level > 0) {
    physicalId.value = Number.parseInt(physicalIdParam as string)
    await fetchPhysicalDetail(physicalId.value)
  }
})

useHead({
  title: () => physicalId.value ? t('addPhysicalShop.page_title_edit') : t('addPhysicalShop.page_title_add')
})
</script>
