#!/usr/bin/env bash
set -e

export LD_LIBRARY_PATH="/media/utkarsh/Utkarsh/greenBuilding/lib:$LD_LIBRARY_PATH"
export PIP_CACHE_DIR="/media/utkarsh/Utkarsh/greenBuilding/pip_cache"
export PYTHONPATH="/media/utkarsh/Utkarsh/greenBuilding/packages:$PYTHONPATH"
export DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1

echo "======================================================================"
echo "🌿 Starting Autonomous CAD Gemini Auto-Annotation & Training Pipeline"
echo "Working storage: /media/utkarsh/Utkarsh/greenBuilding/"
echo "Target weights:  /home/utkarsh/Desktop/greenBuilding/backend/weights/best.pt"
echo "Log file:        /media/utkarsh/Utkarsh/greenBuilding/pipeline.log"
echo "======================================================================"

python3 /home/utkarsh/Desktop/greenBuilding/scripts/cad_gemini_pipeline.py 2>&1 | tee "/media/utkarsh/Utkarsh/greenBuilding/pipeline.log"
