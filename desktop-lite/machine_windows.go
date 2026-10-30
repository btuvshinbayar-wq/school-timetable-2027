//go:build windows

package main

import (
	"strings"

	"golang.org/x/sys/windows/registry"
)

// rawMachineID — Windows MachineGuid (64 битийн бүртгэлээс; `reg query ... /reg:64`-тэй ижил)
func rawMachineID() string {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Cryptography`, registry.QUERY_VALUE|registry.WOW64_64KEY)
	if err == nil {
		defer k.Close()
		if v, _, err := k.GetStringValue("MachineGuid"); err == nil && v != "" {
			return "win:" + strings.ToLower(v)
		}
	}
	return fallbackMachineID()
}
