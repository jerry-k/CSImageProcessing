import { useState, useRef } from 'react';
import { Stage, Layer, Image, Circle } from 'react-konva';
import useImage from 'use-image';
import type { GCPSelectorProps } from '../../types';

const GCPImage: React.FC<{ url: string }> = ({ url }) => {
  const [image] = useImage(url, 'anonymous');
  return <Image image={image} />;
};

export const GCPSelector: React.FC<GCPSelectorProps> = ({
  gcpList,
  onSaveGCPs,
  onReset,
  apiBaseUrl
}) => {
  const [gcpPixels, setGcpPixels] = useState<{u: number, v: number}[]>([]);
  const [currentGcpIndex, setCurrentGcpIndex] = useState(0);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const stageRef = useRef<any>(null);

  const allGcpsSelected = currentGcpIndex >= gcpList.length;

  const handleStageDblClick = (e: any) => {
    if (currentGcpIndex >= gcpList.length) return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const clickPoint = {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };

    setGcpPixels([...gcpPixels, { u: clickPoint.x, v: clickPoint.y }]);
    setCurrentGcpIndex(currentGcpIndex + 1);
  };

  const handleSkipGcp = () => {
    if (currentGcpIndex >= gcpList.length) return;
    setGcpPixels([...gcpPixels, { u: -1, v: -1 }]);
    setCurrentGcpIndex(currentGcpIndex + 1);
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale * 1.1 : oldScale / 1.1;
    setStageScale(newScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setStagePos(newPos);
  };

  const handleSaveGcpPixels = async () => {
    const combinedGcpData = gcpList
      .map((gcp, i) => ({
        ...gcp,
        u: gcpPixels[i]?.u,
        v: gcpPixels[i]?.v,
      }))
      .filter(gcp => gcp.u !== -1 && gcp.v !== -1);

    await onSaveGCPs(combinedGcpData);
  };

  const handleReset = async () => {
    try {
      await onReset();
      setGcpPixels([]);
      setCurrentGcpIndex(0);
      // Don't set global status - just reset internal state
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to reset GCP selections: ${errorMessage}`);
    }
  };

  return (
    <>
      <div className='gcp-instructions'>
        {allGcpsSelected ? (
          <p style={{color: 'blue'}}>All GCPs selected. Click Save.</p>
        ) : (
          <div>
            <p>Please <strong>double-click</strong> on the image to mark the location for: 
              <strong> {gcpList[currentGcpIndex].name}</strong>
            </p>
            <button 
              onClick={handleSkipGcp} 
              style={{ 
                marginLeft: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
            >
              Skip This GCP
            </button>
          </div>
        )}
      </div>
      
      <div className='konva-container'>
        <Stage 
          width={800} 
          height={600} 
          onDblClick={handleStageDblClick}
          onWheel={handleWheel}
          onDragEnd={(e) => setStagePos(e.target.position())}
          ref={stageRef}
          draggable
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
        >
          <Layer>
            <GCPImage url={`${apiBaseUrl}/api/images/control`} />
            {gcpPixels.map((pos, i) => {
              if (pos.u === -1) return null;
              return <Circle key={i} x={pos.u} y={pos.v} radius={5 / stageScale} fill="red" />
            })}
          </Layer>
        </Stage>
      </div>
      
      {allGcpsSelected && (
        <button 
          onClick={handleSaveGcpPixels} 
          style={{ 
            marginTop: '1rem',
            backgroundColor: '#28a745',
            color: 'white'
          }}
        >
          Save GCPs
        </button>
      )}

      <button 
        onClick={handleReset} 
        style={{ marginTop: '1rem', marginLeft: '1rem', background: '#f0ad4e', color: '#000' }}
      >
        Restart Selection
      </button>
    </>
  );
};