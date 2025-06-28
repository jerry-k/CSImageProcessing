import { useState, useEffect } from 'react';
import { Stage, Layer, Image, Line, Circle } from 'react-konva';
import useImage from 'use-image';
import type { MaskCreatorProps } from '../../types';
import { API_BASE_URL, CANVAS_DIMENSIONS } from '../../constants';

export const MaskCreator: React.FC<MaskCreatorProps> = ({ onSave }) => {
  const [image, imageStatus] = useImage(`${API_BASE_URL}/api/images/control`, 'anonymous');
  const [polygons, setPolygons] = useState<number[][]>([]);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isMouseOver, setIsMouseOver] = useState(false);
  const [scale, setScale] = useState(1);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });

  const containerWidth = CANVAS_DIMENSIONS.WIDTH;
  const containerHeight = CANVAS_DIMENSIONS.HEIGHT;

  useEffect(() => {
    if (imageStatus === 'loaded' && image) {
      const scaleRatio = Math.min(1, containerWidth / image.width, containerHeight / image.height);
      setScale(scaleRatio);
      setImgSize({ width: image.width * scaleRatio, height: image.height * scaleRatio });
    }
  }, [image, imageStatus, containerWidth, containerHeight]);

  const handleMouseDown = (e: any) => {
    if (e.target.getStage().getPointerPosition().y > imgSize.height) return;
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    setCurrentPoints([pos.x, pos.y]);
  };

  const handleMouseMove = (e: any) => {
    const pos = e.target.getStage().getPointerPosition();
    setCursorPos(pos);
    if (!isDrawing) return;
    setCurrentPoints(prevPoints => [...prevPoints, pos.x, pos.y]);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    // Only add polygon if it has more than one point
    if (currentPoints.length > 2) {
      setPolygons(prevPolygons => [...prevPolygons, currentPoints]);
    }
    setCurrentPoints([]);
  };

  const handleUndo = () => {
    setPolygons(polygons.slice(0, -1));
  };

  const handleSaveClick = async () => {
    const polygonsInOriginalCoords = polygons.map(flatPoints => {
      const pairedPoints = [];
      for (let i = 0; i < flatPoints.length; i += 2) {
        pairedPoints.push([flatPoints[i] / scale, flatPoints[i + 1] / scale]);
      }
      return pairedPoints;
    });
    await onSave(polygonsInOriginalCoords);
  };

  return (
    <>
      <p>Click and drag on the image to draw regions of interest. The image is scaled to fit; your drawing will be mapped to the full-resolution image.</p>
      <div className='konva-container'>
        <Stage
          width={containerWidth}
          height={containerHeight}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseEnter={() => setIsMouseOver(true)}
          onMouseLeave={() => setIsMouseOver(false)}
        >
          <Layer>
            {imageStatus === 'loaded' && image ? (
              <Image image={image} width={imgSize.width} height={imgSize.height} />
            ) : (
              <></>
            )}
            {polygons.map((poly, i) => (
              <Line key={i} points={poly} stroke="red" strokeWidth={2} closed fill="rgba(255, 0, 0, 0.2)" />
            ))}
            <Line points={currentPoints} stroke="red" strokeWidth={2} />
          </Layer>
          <Layer>
            <Circle x={cursorPos.x} y={cursorPos.y} radius={5} fill="red" visible={isMouseOver && !isDrawing} />
          </Layer>
        </Stage>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <button 
          onClick={handleUndo} 
          disabled={polygons.length === 0}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: polygons.length === 0 ? '#ccc' : '#f0ad4e',
            color: polygons.length === 0 ? '#666' : '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: polygons.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Undo Last Polygon
        </button>
        <button 
          onClick={handleSaveClick} 
          disabled={polygons.length === 0} 
          style={{ 
            marginLeft: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: polygons.length === 0 ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: polygons.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Save Mask
        </button>
      </div>
    </>
  );
};