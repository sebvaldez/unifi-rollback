export namespace inventory {
	
	export class DeviceCapabilities {
	    inventory: boolean;
	    restart: boolean;
	    locate: boolean;
	    rollback: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DeviceCapabilities(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.inventory = source["inventory"];
	        this.restart = source["restart"];
	        this.locate = source["locate"];
	        this.rollback = source["rollback"];
	    }
	}
	export class Device {
	    id: string;
	    siteId: string;
	    name: string;
	    model: string;
	    firmware: string;
	    status: string;
	    site: string;
	    mac?: string;
	    iconUrl?: string;
	    inScope: boolean;
	    scopeLostAt?: string;
	    capabilities: DeviceCapabilities;
	
	    static createFrom(source: any = {}) {
	        return new Device(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.siteId = source["siteId"];
	        this.name = source["name"];
	        this.model = source["model"];
	        this.firmware = source["firmware"];
	        this.status = source["status"];
	        this.site = source["site"];
	        this.mac = source["mac"];
	        this.iconUrl = source["iconUrl"];
	        this.inScope = source["inScope"];
	        this.scopeLostAt = source["scopeLostAt"];
	        this.capabilities = this.convertValues(source["capabilities"], DeviceCapabilities);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace main {
	
	export class CredentialEntry {
	    account: string;
	
	    static createFrom(source: any = {}) {
	        return new CredentialEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.account = source["account"];
	    }
	}
	export class ProbedSiteSummary {
	    siteId: string;
	    siteName: string;
	    hostId?: string;
	    permission?: string;
	
	    static createFrom(source: any = {}) {
	        return new ProbedSiteSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.siteId = source["siteId"];
	        this.siteName = source["siteName"];
	        this.hostId = source["hostId"];
	        this.permission = source["permission"];
	    }
	}
	export class ValidationSummary {
	    sites: ProbedSiteSummary[];
	    applicationsObserved: string[];
	    hostCount: number;
	    deviceCount: number;
	    notes?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ValidationSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sites = this.convertValues(source["sites"], ProbedSiteSummary);
	        this.applicationsObserved = source["applicationsObserved"];
	        this.hostCount = source["hostCount"];
	        this.deviceCount = source["deviceCount"];
	        this.notes = source["notes"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CredentialSlot {
	    id: string;
	    kind: string;
	    label: string;
	    status: string;
	    capabilities: string[];
	    enabled: boolean;
	    boundSiteId?: string;
	    boundSiteName?: string;
	    boundHostId?: string;
	    maskedSuffix?: string;
	    lastValidatedAt?: string;
	    validationError?: string;
	    validationSummary?: ValidationSummary;
	
	    static createFrom(source: any = {}) {
	        return new CredentialSlot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kind = source["kind"];
	        this.label = source["label"];
	        this.status = source["status"];
	        this.capabilities = source["capabilities"];
	        this.enabled = source["enabled"];
	        this.boundSiteId = source["boundSiteId"];
	        this.boundSiteName = source["boundSiteName"];
	        this.boundHostId = source["boundHostId"];
	        this.maskedSuffix = source["maskedSuffix"];
	        this.lastValidatedAt = source["lastValidatedAt"];
	        this.validationError = source["validationError"];
	        this.validationSummary = this.convertValues(source["validationSummary"], ValidationSummary);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DiscoveredSite {
	    siteId: string;
	    siteName: string;
	
	    static createFrom(source: any = {}) {
	        return new DiscoveredSite(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.siteId = source["siteId"];
	        this.siteName = source["siteName"];
	    }
	}
	
	export class SaveCredentialRequest {
	    slotId: string;
	    secret: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveCredentialRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.slotId = source["slotId"];
	        this.secret = source["secret"];
	        this.label = source["label"];
	    }
	}

}

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

