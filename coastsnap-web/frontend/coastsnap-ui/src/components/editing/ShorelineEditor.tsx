import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image, Circle, Line, Rect } from 'react-konva';
import useImage from 'use-image';
import type { ShorelineEditorProps, Point2D } from '../../types';
import { CANVAS_DIMENSIONS, TARGET_EDIT_POINTS } from '../../constants';
import { pixelToWorld, worldToPixel } from '../../utils/coordinates';
import api from '../../services/api';
import { useStatusStore } from '../../stores';
import { approvalCache } from '../../services/approvalCache';
import { logger } from '../../utils/logger';

interface ShorelineEditorPropsExtended extends ShorelineEditorProps {
  onApprove?: () => void;
}

export const ShorelineEditor: React.FC<ShorelineEditorPropsExtended> = ({
  imageIndex,
  onSave,
  onApprove
}) => {
  const { shorelineStatus, setShorelineStatus } = useStatusStore();
  const [image, imageStatus] = useImage(api.getRectifiedImageUrl(imageIndex), 'anonymous');
  const [registeredImage, registeredImageStatus] = useImage(api.getRegisteredImageUrl(imageIndex), 'anonymous');
  const [overlayImage, setOverlayImage] = useState<HTMLImageElement | null>(null);
  const [shorelinePoints, setShorelinePoints] = useState<Point2D[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const stageRef = useRef<any>(null);
  const lineRef = useRef<any>(null);
  const prevStagePos = useRef<Point2D>({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [registeredImgSize, setRegisteredImgSize] = useState({ width: 0, height: 0 });
  const [isPointDragging, setIsPointDragging] = useState(false);
  const [isBoxing, setIsBoxing] = useState(false);
  const [boxRect, setBoxRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [registeredStageScale, setRegisteredStageScale] = useState(1);
  const [registeredStagePos, setRegisteredStagePos] = useState({ x: 0, y: 0 });

  // Full resolution shoreline data
  const [fullWorldPoints, setFullWorldPoints] = useState<Point2D[]>([]);
  const [editedIndices, setEditedIndices] = useState<number[]>([]);
  const [isApproved, setIsApproved] = useState(false);

  const containerWidth = CANVAS_DIMENSIONS.WIDTH;
  const containerHeight = CANVAS_DIMENSIONS.HEIGHT;
  
  // Toggle between edit and preview mode
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    if (imageStatus === 'loaded' && image) {
      const scale = Math.min(containerWidth / image.width, containerHeight / image.height);
      setStageScale(scale);
      setImgSize({ width: image.width, height: image.height });
      const initialX = (containerWidth - image.width * scale) / 2;
      const initialY = (containerHeight - image.height * scale) / 2;
      setStagePos({ x: initialX, y: initialY });
    }
  }, [image, imageStatus, containerWidth, containerHeight]);

  useEffect(() => {
    if (registeredImageStatus === 'loaded' && registeredImage) {
      // Back to full width for single view
      const scale = Math.min(containerWidth / registeredImage.width, containerHeight / registeredImage.height);
      setRegisteredStageScale(scale);
      setRegisteredImgSize({ width: registeredImage.width, height: registeredImage.height });
      const initialX = (containerWidth - registeredImage.width * scale) / 2;
      const initialY = (containerHeight - registeredImage.height * scale) / 2;
      setRegisteredStagePos({ x: initialX, y: initialY });
    }
  }, [registeredImage, registeredImageStatus, containerWidth, containerHeight]);

  // Clear status when image changes
  useEffect(() => {
    setShorelineStatus('');
  }, [imageIndex]);

  // Auto-clear status messages after 5 seconds
  useEffect(() => {
    if (shorelineStatus) {
      const timer = setTimeout(() => {
        setShorelineStatus('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [shorelineStatus]);

  // Load shoreline data
  useEffect(() => {
    const loadShorelineData = async () => {
      if (imageStatus !== 'loaded' || !image) return;
      
      try {
        const data = await api.getShorelineData(imageIndex);
        
        // Process shoreline data
        if (data.shoreline_points && Array.isArray(data.shoreline_points)) {
          const validPoints = data.shoreline_points.filter((point: any) => 
            point && Array.isArray(point) && point.length >= 2 && 
            point[0] !== null && point[1] !== null
          );
          
          const worldPtsArray: Point2D[] = validPoints.map((p: any) => ({ x: p[0], y: p[1] }));
          setFullWorldPoints(worldPtsArray);

          // Subsample for editing
          let pointsToUse = validPoints;
          let editedIdx: number[] = [];
          if (validPoints.length > TARGET_EDIT_POINTS) {
            const subsampleRate = Math.max(1, Math.floor(validPoints.length / TARGET_EDIT_POINTS));
            pointsToUse = validPoints.filter((_: any, index: number) => index % subsampleRate === 0);
            editedIdx = Array.from({ length: validPoints.length }, (_, idx) => idx)
              .filter(idx => idx % subsampleRate === 0);
          } else {
            editedIdx = Array.from({ length: validPoints.length }, (_, idx) => idx);
          }
          setEditedIndices(editedIdx);
          
          // Convert to pixel coordinates
          const points = pointsToUse.map((point: any) => 
            worldToPixel({ x: point[0], y: point[1] }, image)
          );
          
          setShorelinePoints(points);
        } else if (data.pixel_coordinates && data.pixel_coordinates.x && data.pixel_coordinates.y) {
          // Handle original pixel coordinates
          let xCoords: (number | null)[] = data.pixel_coordinates.x;
          let yCoords: (number | null)[] = data.pixel_coordinates.y;
          
          if (Array.isArray(xCoords) && xCoords.length > 0 && Array.isArray(xCoords[0])) {
            xCoords = xCoords[0] as (number | null)[];
            yCoords = Array.isArray(yCoords) && Array.isArray(yCoords[0]) ? yCoords[0] as (number | null)[] : yCoords;
          }
          
          const validIndices: number[] = [];
          xCoords.forEach((x: number | null, i: number) => {
            if (x !== null && yCoords[i] !== null) {
              validIndices.push(i);
            }
          });
          
          if (validIndices.length > 0) {
            const worldPtsArrayPC: Point2D[] = validIndices.map(i => ({ 
              x: xCoords[i] as number, 
              y: yCoords[i] as number 
            }));
            setFullWorldPoints(worldPtsArrayPC);

            const subsampleRate = Math.max(1, Math.floor(validIndices.length / TARGET_EDIT_POINTS));
            const subsampledIndices = validIndices.filter((_, index) => index % subsampleRate === 0);
            setEditedIndices(subsampledIndices);

            const points = subsampledIndices.map(i => 
              worldToPixel({ x: xCoords[i] as number, y: yCoords[i] as number }, image)
            );
            
            setShorelinePoints(points);
          }
        }
        
        // Set approval status
        setIsApproved(data.approved || false);
        
      } catch (error) {
        setShorelineStatus('Failed to load shoreline data');
      }
    };
    
    loadShorelineData();
  }, [imageIndex, image, imageStatus]);

  // Load overlay when component mounts or points change
  useEffect(() => {
    if (registeredImageStatus === 'loaded' && shorelinePoints.length > 0) {
      refreshOverlay();
    }
  }, [imageIndex, registeredImageStatus, shorelinePoints.length]);

  const handlePointDragEnd = (index: number, newPos: Point2D) => {
    const newPoints = [...shorelinePoints];
    newPoints[index] = newPos;
    setShorelinePoints(newPoints);
    setIsPointDragging(false);
  };

  const handlePointDragMove = (e: any) => {
    if (lineRef.current) {
      const stage = e.target.getStage();
      
      const allPoints = stage.find('.shoreline-point');
      const flatPoints = allPoints.map((p: any) => [p.x(), p.y()]).flat();
      lineRef.current.points(flatPoints);
    }
  };

  const handleSaveClick = async () => {
    if (!image) return;
    const imgDim = { width: image.width, height: image.height };

    // Convert edited control points back to world coordinates
    const editedWorld = shorelinePoints.map(pt => pixelToWorld(pt, imgDim));

    // Update full shoreline
    const updated = [...fullWorldPoints];
    editedIndices.forEach((idx, i) => {
      updated[idx] = editedWorld[i];
    });

    // Interpolate between control points
    for (let i = 0; i < editedIndices.length - 1; i++) {
      const startIdx = editedIndices[i];
      const endIdx = editedIndices[i + 1];
      const startPt = updated[startIdx];
      const endPt = updated[endIdx];
      const span = endIdx - startIdx;

      if (span > 1) {
        for (let k = 1; k < span; k++) {
          const t = k / span;
          updated[startIdx + k] = {
            x: startPt.x + t * (endPt.x - startPt.x),
            y: startPt.y + t * (endPt.y - startPt.y),
          };
        }
      }
    }

    try {
      await onSave(updated);
      setFullWorldPoints(updated);
      setShorelineStatus('✓ Shoreline saved successfully!');
      // Refresh overlay image
      await refreshOverlay();
    } catch (error) {
      setShorelineStatus('✗ Failed to save shoreline');
    }
  };

  const refreshOverlay = async () => {
    try {
      const overlayUrl = api.getRegisteredImageWithShorelineUrl(imageIndex);
      const fullUrl = overlayUrl + '?t=' + Date.now();
      
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.src = fullUrl;
      img.onload = () => {
        setOverlayImage(img);
      };
      img.onerror = () => {
        setOverlayImage(null);
      };
    } catch (error) {
      setOverlayImage(null);
    }
  };

  const handleApproveClick = async () => {
    try {
      // First try to approve in backend
      await api.approveShoreline(imageIndex);
      
      // Only update UI state if backend succeeded
      setIsApproved(true);
      setShorelineStatus('Shoreline approved!');
      
      // Update the cache after successful backend update
      approvalCache.updateStatus(imageIndex, true);
      
      if (onApprove) {
        onApprove();
      }
    } catch (error) {
      logger.error('Failed to approve shoreline:', error);
      setShorelineStatus(`Failed to approve shoreline: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Make sure UI reflects the actual state
      setIsApproved(false);
      // Make sure cache also reflects failure
      approvalCache.updateStatus(imageIndex, false);
    }
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    if (!stageRef.current) return;

    const scaleBy = 1.05;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    setStageScale(newScale);

    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleMouseDown = (e: any) => {
    if (isPointDragging) return;

    if (e.evt.shiftKey) {
      if (!stageRef.current) return;
      const pos = stageRef.current.getPointerPosition();
      setBoxRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
      setIsBoxing(true);
      return;
    }

    setIsDragging(true);
    prevStagePos.current = stageRef.current.getPointerPosition();
  };

  const handleMouseMove = () => {
    if (isBoxing && boxRect && stageRef.current) {
      const pos = stageRef.current.getPointerPosition();
      setBoxRect({
        ...boxRect,
        w: pos.x - boxRect.x,
        h: pos.y - boxRect.y,
      });
      return;
    }

    if (!isDragging) return;
    
    if (stageRef.current) {
      const pos = stageRef.current.getPointerPosition();
      const dx = pos.x - prevStagePos.current.x;
      const dy = pos.y - prevStagePos.current.y;

      setStagePos(prev => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));
      prevStagePos.current = pos;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);

    if (isBoxing && boxRect && stageRef.current) {
      setIsBoxing(false);
      
      const stage = stageRef.current;
      const currentScale = stage.scaleX();
      
      if (Math.abs(boxRect.w) < 10 || Math.abs(boxRect.h) < 10) {
        setBoxRect(null);
        return;
      }

      const newScale = currentScale * (stage.width() / Math.abs(boxRect.w));
      const newPos = {
        x: stage.x() - boxRect.x * newScale + (stage.width() / 2) - (boxRect.w / 2 * newScale),
        y: stage.y() - boxRect.y * newScale + (stage.height() / 2) - (boxRect.h / 2 * newScale)
      };

      setStageScale(newScale);
      setStagePos(newPos);
      setBoxRect(null);
    }
  };

  return (
    <div className="shoreline-editor-container">
      <h3>Shoreline Editor</h3>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#666', fontSize: '14px' }}>
          {viewMode === 'edit' ? 'Edit shoreline points on rectified image' : 'Preview shoreline overlay on registered image'}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setViewMode('edit')}
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: viewMode === 'edit' ? '#007bff' : '#e9ecef',
              color: viewMode === 'edit' ? 'white' : '#495057',
              border: '1px solid ' + (viewMode === 'edit' ? '#007bff' : '#dee2e6'),
              borderRadius: '4px 0 0 4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: viewMode === 'edit' ? '500' : 'normal'
            }}
          >
            Edit Mode
          </button>
          <button
            onClick={() => setViewMode('preview')}
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: viewMode === 'preview' ? '#007bff' : '#e9ecef',
              color: viewMode === 'preview' ? 'white' : '#495057',
              border: '1px solid ' + (viewMode === 'preview' ? '#007bff' : '#dee2e6'),
              borderRadius: '0 4px 4px 0',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: viewMode === 'preview' ? '500' : 'normal'
            }}
          >
            Preview Overlay
          </button>
        </div>
      </div>
      <div className="shoreline-controls" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <button 
          onClick={handleSaveClick}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#218838'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
        >
          Save Shoreline
        </button>
        <button 
          onClick={handleApproveClick}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: isApproved ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isApproved ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            opacity: isApproved ? 0.6 : 1
          }}
          disabled={isApproved}
          onMouseEnter={(e) => !isApproved && (e.currentTarget.style.backgroundColor = '#0056b3')}
          onMouseLeave={(e) => !isApproved && (e.currentTarget.style.backgroundColor = '#007bff')}
        >
          {isApproved ? '✓ Approved' : 'Approve'}
        </button>
        {isApproved && (
          <span style={{ color: '#28a745', fontWeight: '500' }}>
            ✓ This shoreline has been approved
          </span>
        )}
      </div>
      {shorelineStatus && (
        <div style={{
          padding: '0.5rem 1rem',
          marginBottom: '1rem',
          backgroundColor: shorelineStatus.includes('✓') ? '#d4edda' : shorelineStatus.includes('✗') ? '#f8d7da' : '#cce5ff',
          color: shorelineStatus.includes('✓') ? '#155724' : shorelineStatus.includes('✗') ? '#721c24' : '#004085',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          {shorelineStatus}
        </div>
      )}
      {/* Main display area */}
      {viewMode === 'edit' ? (
        /* Edit Mode: Rectified image with editable points */
        <div style={{ 
          border: '2px solid #ddd', 
          borderRadius: '4px', 
          overflow: 'hidden', 
          width: containerWidth, 
          height: containerHeight,
          backgroundColor: '#f5f5f5'
        }}>
          <Stage
            width={containerWidth}
            height={containerHeight}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            ref={stageRef}
          >
        <Layer>
          <Image image={image} width={imgSize.width} height={imgSize.height} />
          {shorelinePoints.map((point, index) => (
            <Circle
              key={index}
              name={`point-${index}`}
              className="shoreline-point"
              x={point.x}
              y={point.y}
              radius={15 / stageScale}
              fill="red"
              stroke="white"
              strokeWidth={3 / stageScale}
              draggable
              onDragMove={handlePointDragMove}
              onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'grab';
                e.target.scale({ x: 1.2, y: 1.2 });
              }}
              onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'default';
                e.target.scale({ x: 1, y: 1 });
              }}
              onDragStart={(e) => {
                setIsPointDragging(true);
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'grabbing';
              }}
              onDragEnd={(e) => {
                handlePointDragEnd(index, { x: e.target.x(), y: e.target.y() });
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'grab';
              }}
            />
          ))}
          <Line
            ref={lineRef}
            points={shorelinePoints.flatMap(p => [p.x, p.y])}
            stroke="red"
            strokeWidth={3 / stageScale}
            lineCap="round"
            lineJoin="round"
            tension={0.3}
          />
          {boxRect && (
            <Rect
              x={boxRect.x}
              y={boxRect.y}
              width={boxRect.w}
              height={boxRect.h}
              fill="rgba(0, 162, 255, 0.2)"
              stroke="rgba(0, 162, 255, 1)"
              strokeWidth={2 / stageScale}
            />
          )}
          </Layer>
        </Stage>
      </div>
      ) : (
        /* Preview Mode: Single view with overlay toggle */
        <div style={{ position: 'relative' }}>
          {/* Overlay toggle button */}
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            zIndex: 10,
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <button
              onClick={() => setShowOverlay(!showOverlay)}
              style={{
                padding: '6px 12px',
                backgroundColor: showOverlay ? '#ffc107' : '#6c757d',
                color: showOverlay ? '#000' : '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '16px' }}>{showOverlay ? '👁️' : '👁️‍🗨️'}</span>
              {showOverlay ? 'Hide Shoreline' : 'Show Shoreline'}
            </button>
          </div>
          
          {/* Image display */}
          <div style={{ 
            border: '2px solid #ddd', 
            borderRadius: '4px', 
            overflow: 'hidden', 
            width: containerWidth, 
            height: containerHeight,
            backgroundColor: '#f5f5f5'
          }}>
            <Stage
              width={containerWidth}
              height={containerHeight}
              scaleX={registeredStageScale}
              scaleY={registeredStageScale}
              x={registeredStagePos.x}
              y={registeredStagePos.y}
            >
              <Layer>
                {showOverlay && overlayImage ? (
                  <Image image={overlayImage} width={registeredImgSize.width} height={registeredImgSize.height} />
                ) : (
                  <Image image={registeredImage} width={registeredImgSize.width} height={registeredImgSize.height} />
                )}
              </Layer>
            </Stage>
          </div>
        </div>
      )}
    </div>
  );
};