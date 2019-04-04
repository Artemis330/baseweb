import React from 'react';
import {Button} from 'baseui/button';
import ArrowDown from 'baseui/icon/arrow-down';
import {StatefulPopover, PLACEMENT} from 'baseui/popover';
import {StatefulMenu} from 'baseui/menu';

const ITEMS = [
  {label: 'Item One'},
  {label: 'Item Two'},
  {label: 'Item Three'},
  {label: 'Item Four'},
  {label: 'Item Five'},
  {label: 'Item Six'},
  {label: 'Item Seven'},
  {label: 'Item Eight'},
  {label: 'Item Nine'},
  {label: 'Item Ten'},
  {label: 'Item Eleven'},
  {label: 'Item Twelve'},
];

export default () => (
  <StatefulPopover
    placement={PLACEMENT.bottomLeft}
    content={({close}) => (
      <StatefulMenu
        items={ITEMS}
        onItemSelect={() => close()}
        overrides={{List: {style: {height: '150px', width: '150px'}}}}
      />
    )}
  >
    <Button endEnhancer={() => <ArrowDown size={24} />}>Open Menu</Button>
  </StatefulPopover>
);
