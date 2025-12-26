import React from "react";
import * as THREE from 'three'

import "./index.less";
import app from './app.js'
import './load.js'
import {
  DownOutlined, UpOutlined
} from '@ant-design/icons';
import { Button, Drawer, Collapse, message, Input, Tag, Tabs } from 'antd';
import RankingList from './rankList.jsx'
import { getDistributedMaps } from '../../api/statistics.js'
// const geojson = require('./geoJson.json')
const geojson = require('./world.json')

class Index extends React.Component {  
    state = {
      id: null,
      latRange: null,
      lonRange: null,
      features: [], // 省
      rank_list: []
    }
    constructor(props) {
      super(props);
      this.canvasRef = React.createRef();
    }
    latLonToXYZ(lat, lon) {
      const { lonRange, latRange } = this.state
      const x = (lon - lonRange.min) / (lonRange.max - lonRange.min) * 1000;  // 经度映射到 X 轴
      const y = (lat - latRange.min) / (latRange.max - latRange.min) * 1000;  // 纬度映射到 Y 轴
      const z = 0;  // 假设地面海拔为 0
      return new THREE.Vector3(x, y, z);
  }
    
    async componentDidMount() {
      // 在组件挂载后执行逻辑
      // 获取地址栏？id=123参数
      document.title = 'Lo娘分布地图';
      const urlParams = this.getHashQueryParams();
      const id = urlParams.get('id');
      this.setState({
        id
      })
      const _this = this
      const webGldom = document.getElementById('webgl');
      app.init(webGldom, _this);
      // 设置平移
      app.controls.mouseButtons = {
				// LEFT: THREE.MOUSE.PAN,
				MIDDLE: THREE.MOUSE.DOLLY,
				RIGHT: THREE.MOUSE.ROTATE
			}
			app.controls.touches = { 
        // ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_PAN
      };
      
      
      // const { latRange, lonRange } = this.calculateLatLonRange(geojson)
      // this.setState({
      //   latRange,
      //   lonRange
      // })
      // 将北京的经纬度转换为三维坐标
      // const cameraPosition = this.latLonToXYZ(39.9042, 116.4074);
      app.textFont = await app.createFont()
      const features = []
      geojson.features.forEach((item) => {
        if (item.properties.name !== '') {
          features.push({ 
            name: item.properties.name,
            center: item.properties.center,
            count: 0
          })
        }
      })
      this.setState({
        features
      })
      this.getDistributedAndCreate()
      app.focusOnLatLng(31.51, 121.4, 5, 0)

      // 初始化变量
    let isDragging = false;
    let previousMousePosition = {
        x: 0,
        y: 0
    };
      document.addEventListener('mousedown', function(event) {
          if (event.button === 0) { // 左键
              isDragging = true;
          }
      });
      
      // 鼠标松开事件
      document.addEventListener('mouseup', function(event) {
          if (event.button === 0) { // 左键
              isDragging = false;
          }
      });
      
      // 鼠标移动事件
      document.addEventListener('mousemove', function(event) {
          if (isDragging) {
              const deltaMove = {
                  x: event.offsetX - previousMousePosition.x,
                  y: event.offsetY - previousMousePosition.y
              };
              // console.log(deltaMove)
              app.controls.target.x -= deltaMove.x * 0.1
              app.controls.target.y += deltaMove.y * 0.1
              app.camera.position.x = app.controls.target.x
              app.camera.position.y = app.controls.target.y - 40 * app.camera.position.z / 40
              app.camera.lookAt(app.controls.target)
          }
      
          previousMousePosition = {
              x: event.offsetX,
              y: event.offsetY
          };
      });
      
      // 触摸开始事件
      document.addEventListener('touchstart', function(event) {
          if (event.touches.length === 1) { // 单指
              isDragging = true;
              const touch = event.touches[0];
              previousMousePosition = {
                x: touch.clientX,
                y: touch.clientY
            };
          }
      });
      
      // 触摸结束事件
      document.addEventListener('touchend', function(event) {
        isDragging = false;
          // if (event.touches.length === 0) { // 无手指
          //     isDragging = false;
          // }
      });
      
      // 触摸移动事件
      document.addEventListener('touchmove', function(event) {
          if (isDragging && event.touches.length === 1) {
              const touch = event.touches[0];
              const deltaMove = {
                  x: touch.clientX - previousMousePosition.x,
                  y: touch.clientY - previousMousePosition.y
              };
              app.controls.target.x -= deltaMove.x * 0.1
              app.controls.target.y += deltaMove.y * 0.1
              app.camera.position.x = app.controls.target.x
              app.camera.position.y = app.controls.target.y - 40 * app.camera.position.z / 40
              app.camera.lookAt(app.controls.target)
              // const deltaRotationQuaternion = new THREE.Quaternion()
              //     .setFromEuler(new THREE.Euler(
              //         toRadians(deltaMove.y * 1),
              //         toRadians(deltaMove.x * 1),
              //         0,
              //         'XYZ'
              //     ));
      
              // cube.quaternion.multiplyQuaternions(deltaRotationQuaternion, cube.quaternion);
      
              previousMousePosition = {
                  x: touch.clientX,
                  y: touch.clientY
              };
          }
      });
      
      // 辅助函数：将角度转换为弧度
      function toRadians(angle) {
          return angle * (Math.PI / 180);
      }
    
    }
    /**
     * 计算省份分布排名
     * @param {Array} features - 包含 { name, count } 的数组
     * @param {number} [topN] - 仅返回前 N 名（可选）
     * @returns {Array} 排名后的结果，每项包含 { rank, name, count, percent }
     */
    rankDistribution(features, topN = null) {
      const total = features.reduce((sum, f) => sum + (f.count || 0), 0);
      const sorted = [...features]
        .filter(f => f.count > 0)
        .sort((a, b) => b.count - a.count)
        .map((f, index) => ({
          rank: index + 1,
          name: f.name,
          count: f.count,
          percent: total > 0 ? ((f.count / total) * 100).toFixed(2) + '%' : '0%'
        }));
      return topN ? sorted.slice(0, topN) : sorted;
    }
    // 获取数据并且创建圆柱
    getDistributedAndCreate () {
      getDistributedMaps()
        .then((res) => {
          const { data } = res
          let count = 0
          let { features } = this.state
          features = features.map((child) => {
            child.count = 0
            return {
              ...child
            }
          })
          
          data.forEach((child) => {
            const index = features.findIndex((item) => {
              return item.name.includes(child.ip_location)
            })
            if (index !== -1) {
              features[index].count = child.COUNT
              geojson.features[index].count = child.COUNT
              count += child.COUNT
            }
          })
          const rankedList = this.rankDistribution(features);
          console.log(rankedList, '排行榜');
          this.setState({
            rank_list: rankedList
          })
          // ✅ 给中国省份排名
        const provinceName = [
          '北京市', '天津市', '河北省', '山西省', '内蒙古自治区', '辽宁省', '吉林省', '黑龙江省',
          '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省',
          '湖北省', '湖南省', '广东省', '广西壮族自治区', '海南省', '重庆市', '四川省', '贵州省',
          '云南省', '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区',
          '台湾省', '香港特别行政区', '澳门特别行政区'
        ];
        const chinaFeaturesWithIndex = geojson.features
        .map((f, i) => ({ feature: f, index: i }))
        .filter(item => provinceName.includes(item.feature.properties.name));
        chinaFeaturesWithIndex
        .sort((a, b) => (b.feature.count || 0) - (a.feature.count || 0))
        .forEach((item, i) => {
          geojson.features[item.index].rank = i + 1;
        });
          console.log('features区块', features, geojson)
          
          const province = new THREE.Group();
          features.forEach((child) => {
            if (child.count > 0 && child.center) {
              try {
                const cyl = app.createCylinderAtLatLng(child.center[1], child.center[0], (child.count / count) * 20, child.name + ' ' + child.count)
                province.add(cyl)
              } catch (error) {
                console.log(error)
              }
            }
          })
          if (app.province) {
              app.scene.remove(app.province);
              app.province = null
          }
          app.province = province
          app.scene.add(province)
          console.log('总数', count)
          const group = app.createGeoJsonMap(geojson, { totalCount: count })
          app.objects = group.children
          app.scene.add(group)
        })
    }
    calculateLatLonRange(geojson) {
      let latRange = { min: Infinity, max: -Infinity };
      let lonRange = { min: Infinity, max: -Infinity };
  
      geojson.features.forEach(feature => {
          if (feature.geometry.type === 'Point') {
              // const [lon, lat] = feature.geometry.coordinates;
              // latRange.min = Math.min(latRange.min, lat);
              // latRange.max = Math.max(latRange.max, lat);
              // lonRange.min = Math.min(lonRange.min, lon);
              // lonRange.max = Math.max(lonRange.max, lon);
          } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
              // feature.geometry.coordinates.forEach(polygon => {
              //     polygon.forEach(ring => {
              //         ring.forEach(([lon, lat]) => {
              //             latRange.min = Math.min(latRange.min, lat);
              //             latRange.max = Math.max(latRange.max, lat);
              //             lonRange.min = Math.min(lonRange.min, lon);
              //             lonRange.max = Math.max(lonRange.max, lon);
              //         });
              //     });
              // });
          }
      });
  
      return { latRange, lonRange };
  }
    getHashQueryParams() {
      const hash = window.location.hash;
      const hashWithoutHashSymbol = hash.slice(1);
      const questionIndex = hashWithoutHashSymbol.indexOf('?');
      if (questionIndex !== -1) {
          const queryString = hashWithoutHashSymbol.slice(questionIndex + 1);
          return new URLSearchParams(queryString);
      }
      return new URLSearchParams();
  }
  render() {
      const { rank_list } = this.state
      return (
          <div className="lolita-wrap">
            <RankingList data={rank_list} />
            <div id="webgl"></div>
          </div>
      );
  }
}

export default Index;

