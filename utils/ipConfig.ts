// export const BASE_IMG: string = 'http://localhost:3000/ali/'
// export const BASE_IMG_MODEL: string = 'http://localhost:3000/ali/'
const isDev = false
export const BASE_IMG: string = isDev ? 'http://localhost:3000/ali/' : 'http://image.lolitalibrary.com/'
export const BASE_IMG_MODEL: string = isDev ? 'http://localhost:3000/ali/' : 'https://image.lolitalibrary.com/'
export const BASE_URL: string = isDev ? 'http://localhost:3002' : 'https://lolitalibrary.com/node/'