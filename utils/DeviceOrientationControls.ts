import {
	Euler,
	EventDispatcher,
	MathUtils,
	Quaternion,
	Vector3
} from 'three';

const _zee = new Vector3( 0, 0, 1 );
const _euler = new Euler();
const _q0 = new Quaternion();
const _q1 = new Quaternion( - Math.sqrt( 0.5 ), 0, 0, Math.sqrt( 0.5 ) ); // - PI/2 around the x-axis

class DeviceOrientationControls extends EventDispatcher {

    object: any;
    domElement: any;
    isDeviceOrientationControls: boolean;
    enabled: boolean;
    deviceOrientation: any;
    screenOrientation: any;
    alphaOffset: number;

	constructor( object: any, domElement: any ) {

		super();

		if ( domElement === undefined ) console.warn( 'THREE.DeviceOrientationControls: The second argument "domElement" is now mandatory.' );
		this.domElement = domElement !== undefined ? domElement : document;

		this.object = object;
		this.object.rotation.reorder( 'YXZ' );

		this.enabled = true;

		this.deviceOrientation = {};
		this.screenOrientation = 0;

		this.alphaOffset = 0; // radians

        this.isDeviceOrientationControls = true;

		this.connect();

	}

	onDeviceOrientationChangeEvent = ( event: any ) => {

		this.deviceOrientation = event;

	};

	onScreenOrientationChangeEvent = () => {

		this.screenOrientation = window.orientation || 0;

	};

    connect() {

		this.onScreenOrientationChangeEvent(); // run once on load

		// iOS 13+
		if ( window.DeviceOrientationEvent !== undefined && typeof ( window.DeviceOrientationEvent as any ).requestPermission === 'function' ) {

			( window.DeviceOrientationEvent as any ).requestPermission().then( ( response: any ) => {

				if ( response == 'granted' ) {

					window.addEventListener( 'orientationchange', this.onScreenOrientationChangeEvent );
					window.addEventListener( 'deviceorientation', this.onDeviceOrientationChangeEvent );

				}

			} ).catch( ( error: any ) => {

				console.error( 'THREE.DeviceOrientationControls: Unable to use DeviceOrientation API:', error );

			} );

		} else {

			window.addEventListener( 'orientationchange', this.onScreenOrientationChangeEvent );
			window.addEventListener( 'deviceorientation', this.onDeviceOrientationChangeEvent );

		}

		this.enabled = true;

	};

	disconnect() {

		window.removeEventListener( 'orientationchange', this.onScreenOrientationChangeEvent );
		window.removeEventListener( 'deviceorientation', this.onDeviceOrientationChangeEvent );

		this.enabled = false;

	};

	update() {

		if ( this.enabled === false ) return;

		const device = this.deviceOrientation;

		if ( device ) {

			const alpha = device.alpha ? MathUtils.degToRad( device.alpha ) + this.alphaOffset : 0; // Z

			const beta = device.beta ? MathUtils.degToRad( device.beta ) : 0; // X'

			const gamma = device.gamma ? MathUtils.degToRad( device.gamma ) : 0; // Y''

			const orient = this.screenOrientation ? MathUtils.degToRad( this.screenOrientation ) : 0; // O

			this.setObjectQuaternion( this.object.quaternion, alpha, beta, gamma, orient );

		}

	};

	dispose() {

		this.disconnect();

	};

    setObjectQuaternion( quaternion: any, alpha: any, beta: any, gamma: any, orient: any ) {

		_euler.set( beta, alpha, - gamma, 'YXZ' ); // 'ZXY' for the device, but 'YXZ' for us

		quaternion.setFromEuler( _euler ); // orient the device

		quaternion.multiply( _q1 ); // camera looks out the back of the device, not the top

		quaternion.multiply( _q0.setFromAxisAngle( _zee, - orient ) ); // adjust for screen orientation

	}

}

export { DeviceOrientationControls };
