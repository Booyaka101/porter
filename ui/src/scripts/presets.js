// Script presets configuration
// Each script can have presets that combine multiple flags into easy-to-understand options

export const scriptPresets = {
  'embedded-scripts/ubuntu-setup/setupUbuntu_v2.sh': {
    name: 'Ubuntu Setup',
    description: 'Set up Ubuntu 24.04 machines for IDX Games',
    presets: [
       {
        id: 'workstation',
        name: '🖥️ Workstation',
        description: 'For operator computers and control rooms. Installs remote desktop access and license manager.',
        icon: 'computer',
        flags: ['--fresh', '--remote', '--splashtop', '--codemeter'],
        recommended: true,
        warning: null
      },
      {
        id: 'camera-server',
        name: '🎥 Camera Server',
        description: 'For machines that capture and stream video. Installs Docker, camera tools, and NDI for video streaming.',
        icon: 'videocam',
        flags: ['--fresh', '--remote', '--docker', '--role=cam', '--ndi'],
        recommended: false,
        warning: null
      },
      {
        id: 'ocr-server',
        name: '🔍 OCR Server',
        description: 'For machines that read text from video (needs NVIDIA GPU). Installs Docker with GPU support and OCR tools.',
        icon: 'text_fields',
        flags: ['--fresh', '--remote', '--docker', '--role=ocr', '--ndi'],
        recommended: false,
        warning: 'Requires NVIDIA GPU'
      },
      {
        id: 'vision-server',
        name: '👁️ Vision Server',
        description: 'For machines that process video with AI (needs NVIDIA GPU). Installs Docker with GPU support and vision tools.',
        icon: 'visibility',
        flags: ['--fresh', '--remote', '--docker', '--role=vis', '--ndi'],
        recommended: false,
        warning: 'Requires NVIDIA GPU'
      },
      {
        id: 'fresh-only',
        name: '🔧 Basic Setup',
        description: 'Ubuntu-level install only: system updates, essential packages like fish shell, plocate, htop, and basic configuration. No IDX-specific software.',
        icon: 'build',
        flags: ['--fresh'],
        recommended: false,
        warning: null
      },
      {
        id: 'verify',
        name: '✅ Check Only (Dry Run)',
        description: 'Check if the machine is ready without making any changes. Safe to run anytime.',
        icon: 'check_circle',
        flags: ['--verify'],
        recommended: false,
        warning: null
      },
      {
        id: 'install-agent',
        name: '📡 Install Health Agent',
        description: 'Install the IDX Deploy standalone health monitoring agent. Exposes metrics on port 8083.',
        icon: 'monitor_heart',
        flags: ['--agent'],
        recommended: false,
        warning: 'Requires the standalone agent binary in the script directory'
      }
    ]
  },
  'embedded-scripts/idx-deploy/setupIdx.sh': {
    name: 'IDX Docker Deploy',
    description: 'Deploy IDX Games Docker containers to a server',
    presets: [
      {
        id: 'full-with-collector',
        name: '🚀 Full + Collector',
        description: 'Complete IDX installation with all services and data collector enabled.',
        icon: 'rocket_launch',
        flags: ['--install', '--config=full', '--collector'],
        recommended: true,
        warning: 'Will reboot after installation'
      },
      {
        id: 'full-no-collector',
        name: '📦 Full Stack',
        description: 'Full installation without collector service.',
        icon: 'inventory_2',
        flags: ['--install', '--config=full'],
        recommended: false,
        warning: 'Will reboot after installation'
      },
      {
        id: 'xtrend-only',
        name: '📊 XTrend Only',
        description: 'Standalone XTrend installation without full stack.',
        icon: 'trending_up',
        flags: ['--install', '--config=xtrend'],
        recommended: false,
        warning: 'Will reboot after installation'
      },
      {
        id: 'xvis-only',
        name: '👁️ XVIS Only',
        description: 'XVIS (Vision) components only.',
        icon: 'visibility',
        flags: ['--install', '--config=xvis'],
        recommended: false,
        warning: 'Will reboot after installation'
      },
      {
        id: 'quick-deploy',
        name: '⚡ Quick Deploy',
        description: 'Full installation without automatic reboot.',
        icon: 'flash_on',
        flags: ['--install', '--config=full', '--collector', '--no-reboot'],
        recommended: false,
        warning: null
      }
    ]
  },
  'embedded-scripts/mono-install/installMono.sh': {
    name: 'Mono Application Install',
    description: 'Install the Mono streaming application with NDI support',
    presets: [
      {
        id: 'full-mono',
        name: '🎬 Full Mono Install',
        description: 'Complete Mono installation with Docker, NDI directory service, and all dependencies.',
        icon: 'movie',
        flags: [],
        recommended: true,
        warning: 'Will reboot after installation'
      },
      {
        id: 'no-reboot',
        name: '⚡ Quick Install (No Reboot)',
        description: 'Install Mono without automatic reboot.',
        icon: 'flash_on',
        flags: ['--no-reboot'],
        recommended: false,
        warning: null
      },
      {
        id: 'skip-docker',
        name: '🐳 Skip Docker',
        description: 'Install Mono only (Docker already installed).',
        icon: 'skip_next',
        flags: ['--skip-docker', '--no-reboot'],
        recommended: false,
        warning: null
      }
    ]
  },
  'embedded-scripts/idx-deploy/docker-pre-compose.sh': {
    name: 'Docker Pre-Compose Setup',
    description: 'Create required directories and set permissions for IDX Docker deployment',
    presets: [
      {
        id: 'setup-dirs',
        name: '📁 Setup Directories',
        description: 'Create all required directories under /var/lib/idxgames with proper permissions.',
        icon: 'folder',
        flags: [],
        recommended: true,
        warning: null
      }
    ]
  },
  'default': {
    name: 'Script',
    description: 'Run this script with custom options',
    presets: []
  }
}

// Get presets for a script path
export const getPresetsForScript = (scriptPath) => {
  // Try exact match first
  for (const [key, value] of Object.entries(scriptPresets)) {
    if (scriptPath.endsWith(key)) {
      return value
    }
  }
  return scriptPresets.default
}

// Convert preset flags to flagValues object
export const presetToFlagValues = (preset, scriptFlags) => {
  const flagValues = {}
  
  // Initialize all flags as disabled
  scriptFlags?.forEach(flag => {
    flagValues[flag.long] = { enabled: false, value: '' }
  })
  
  // Enable flags from preset
  preset.flags.forEach(presetFlag => {
    // Handle flags with values like --role=cam
    if (presetFlag.includes('=')) {
      const [flagName, flagValue] = presetFlag.split('=')
      flagValues[flagName] = { enabled: true, value: flagValue }
    } else {
      flagValues[presetFlag] = { enabled: true, value: '' }
    }
  })
  
  return flagValues
}
