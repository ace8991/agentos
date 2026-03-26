# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec — builds AgentOS as a single binary
# Run: pyinstaller agentos.spec
#
# Output:
#   macOS  → dist/AgentOS.app  (double-click to run)
#   Windows → dist/AgentOS.exe
#   Linux  → dist/agentos

import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect all dynamic data files needed by libraries
datas = []
datas += collect_data_files("anthropic")
datas += collect_data_files("tavily")
datas += collect_data_files("playwright")
datas += collect_data_files("certifi")
datas += collect_data_files("httpx")

# Hidden imports that PyInstaller misses
hiddenimports = []
hiddenimports += collect_submodules("anthropic")
hiddenimports += collect_submodules("fastapi")
hiddenimports += collect_submodules("uvicorn")
hiddenimports += collect_submodules("pydantic")
hiddenimports += collect_submodules("starlette")
hiddenimports += collect_submodules("tavily")
hiddenimports += collect_submodules("playwright")
hiddenimports += [
    "pyautogui", "mss", "PIL",
    "uvicorn.logging", "uvicorn.loops", "uvicorn.loops.auto",
    "uvicorn.protocols", "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto", "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto", "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "email.mime.text", "email.mime.multipart",
    "dotenv",
]

a = Analysis(
    ["run.py"],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "test", "unittest"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# ── Single-file executable ────────────────────────────────────────────────
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="AgentOS",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,        # set False to hide terminal on Windows
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# ── macOS .app bundle ────────────────────────────────────────────────────
if sys.platform == "darwin":
    app = BUNDLE(
        exe,
        name="AgentOS.app",
        icon=None,           # add icon.icns here if you have one
        bundle_identifier="com.agentos.backend",
        info_plist={
            "NSHighResolutionCapable": True,
            "NSAppleEventsUsageDescription": "AgentOS needs accessibility access to control your computer.",
            "NSScreenCaptureUsageDescription": "AgentOS needs screen recording to capture the display.",
        },
    )
