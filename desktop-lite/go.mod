module schooltimetable2027/lite

go 1.22

require (
	github.com/jchv/go-webview2 v0.0.0-20260205173254-56598839c808
	golang.org/x/sys v0.30.0
)

require github.com/jchv/go-winloader v0.0.0-20250406163304-c1995be93bd1 // indirect

replace github.com/jchv/go-webview2 => ./third_party/go-webview2

// golang.org/x/sys-ийн GitHub толь (proxy.golang.org хаалттай орчинд ч бүтээгдэнэ)
replace golang.org/x/sys => github.com/golang/sys v0.30.0
