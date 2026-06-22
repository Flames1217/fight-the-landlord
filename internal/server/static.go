package server

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

func spaHandler(distDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(distDir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ws", "/health", "/version":
			http.NotFound(w, r)
			return
		}

		cleanPath := path.Clean(r.URL.Path)
		if cleanPath == "." {
			cleanPath = "/"
		}

		target := filepath.Join(distDir, strings.TrimPrefix(cleanPath, "/"))
		if info, err := os.Stat(target); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
	})
}
