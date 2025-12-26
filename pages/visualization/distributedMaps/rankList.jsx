import React, { useState, useMemo } from "react";

const RankingList = ({ data }) => {
  const [expanded, setExpanded] = useState(false);

  // 内部排序并生成排名
  const sortedData = useMemo(() => {
    // 拷贝避免修改外部数据
    const arr = [...data];
    // 按count降序排序
    arr.sort((a, b) => b.count - a.count);

    // 加rank字段，遇到同分数同名同rank（简单处理）
    let lastCount = null;
    let lastRank = 0;
    let sameRankCount = 0;

    return arr.map((item, idx) => {
      if (item.count === lastCount) {
        sameRankCount++;
      } else {
        lastRank = idx + 1;
        sameRankCount = 1;
        lastCount = item.count;
      }
      return { ...item, rank: lastRank };
    });
  }, [data]);

  return (
    <>
      <style>{`
        .ranking-container {
          position: fixed;
          top: 10px;
          left: 10px;
          width: 280px;
          max-height: 400px;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
            Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
          overflow: hidden;
          z-index: 9999;
        }

        .ranking-header {
          padding: 12px 16px;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          user-select: none;
          border-bottom: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ranking-list {
          max-height: 320px;
          overflow-y: auto;
          transition: max-height 0.3s ease;
        }

        .ranking-item {
          padding: 10px 16px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          justify-content: space-between;
          font-size: 16px;
          color: #333;
        }

        .ranking-item:nth-child(odd) {
          background-color: #fafafa;
        }

        .ranking-rank {
          font-weight: 700;
          width: 28px;
          text-align: center;
          color: #7130ae;
        }

        .ranking-name {
          flex: 1;
          padding-left: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ranking-count {
          min-width: 50px;
          text-align: right;
          color: #666;
          margin-right: 10px;
        }
        .ranking-percent{
          width: 60px;
        }

        .toggle-icon {
          font-size: 20px;
          transition: transform 0.3s ease;
        }
        .toggle-icon.expanded {
          transform: rotate(180deg);
        }

        @media (max-width: 480px) {
          .ranking-container {
            width: 90vw;
            max-height: 60vh;
            top: 5px;
            left: 5vw;
            font-size: 14px;
          }
          .ranking-header {
            font-size: 16px;
          }
          .ranking-item {
            font-size: 14px;
            padding: 8px 12px;
          }
          .ranking-count {
            min-width: 40px;
          }
        }
      `}</style>

      <div className="ranking-container">
        <div
          className="ranking-header"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setExpanded(!expanded);
            }
          }}
        >
          分布图 样本总数：{data.reduce((acc, item) => acc + item.count, 0)}
          <span className={`toggle-icon ${expanded ? "expanded" : ""}`}>
            ▼
          </span>
        </div>

        {expanded && (
          <div className="ranking-list">
            {sortedData.map(({ name, count, rank, percent }) => (
              <div key={`${name}-${rank}`} className="ranking-item" title={name}>
                <div className="ranking-rank">{rank}</div>
                <div className="ranking-name">{name}</div>
                <div className="ranking-count">{count}</div>
                <div className="ranking-percent">{percent}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default RankingList;
