package web

import "embed"

//go:embed build/*
var DefaultUIBuildFS embed.FS

const DefaultUIBuildRoot = "build"
