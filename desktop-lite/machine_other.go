//go:build !windows

package main

import (
	"os"
	"strings"
)

// rawMachineID — Linux дээрх хөгжүүлэлт/тестэд (Node хувилбартай ижил)
func rawMachineID() string {
	for _, f := range []string{"/etc/machine-id", "/var/lib/dbus/machine-id"} {
		if b, err := os.ReadFile(f); err == nil {
			if v := strings.TrimSpace(string(b)); v != "" {
				return "linux:" + v
			}
		}
	}
	return fallbackMachineID()
}
