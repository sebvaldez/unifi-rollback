package unifi

// ProbeReporter receives human-readable progress during credential validation probes.
type ProbeReporter func(label, target string)

func reportProbeStep(report ProbeReporter, label, target string) {
	if report != nil {
		report(label, target)
	}
}
