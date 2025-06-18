#pragma once
#include <inttypes.h>
namespace knitsim {
  enum KnitNodeTypeC {
    PURL = 0,
    KNIT,
    SLIP,
    YARN_OVER,
    INCREASE,
    DECREASE,
    BIND_OFF,
    CAST_ON,
  };
  enum KnitModeC {
    ROUND = 0,
    FLAT,
  };
  enum KnitEdgeDirectionC {
    ROW = 0,
    COLUMN,
    BOTH,
    STITCH,
    START,
  };
  enum KnitSideC {
    RIGHT = 0,
    WRONG,
  };
  class YarnSpecC {
   public:
    uint32_t color;
    uint32_t weight;
    YarnSpecC(int color, int weight) {
      this->color = color;
      this->weight = weight;
    }
  };
} // namespace knitsim