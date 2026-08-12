export namespace settings {
	
	export class DeviceSettings {
	    refreshMode: string;
	    pollIntervalSeconds: number;
	    refreshOnStartup: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DeviceSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.refreshMode = source["refreshMode"];
	        this.pollIntervalSeconds = source["pollIntervalSeconds"];
	        this.refreshOnStartup = source["refreshOnStartup"];
	    }
	}

}

