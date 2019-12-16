/*
Copyright (c) 2018-2019 Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/

/* eslint-disable flowtype/require-valid-file-annotation */

import * as React from 'react';
import {withStyle} from 'baseui';
import {Navigation, StyledNavItem} from 'baseui/side-navigation';

import Routes from '../routes';

const CustomStyledNavItem = withStyle(
  StyledNavItem,
  ({$theme, $active, $hasItemId, $level}) => ({
    paddingTop: $theme.sizing.scale200,
    paddingBottom: $theme.sizing.scale200,
    ...($theme.name.startsWith('dark') && $active
      ? {
          backgroundColor: $theme.colors.backgroundSecondary,
        }
      : {}),
    ...(!$hasItemId || $level === 1
      ? {
          textTransform: 'uppercase',
          ...($level === 1
            ? $theme.typography.font350
            : $theme.typography.font250),
        }
      : {}),
  }),
);

const removeSlash = path => path && path.replace(/\/$/, '');

const CustomNavItem = ({
  item,
  onSelect,
  onClick,
  onKeyDown,
  ...sharedProps
}) => (
  <CustomStyledNavItem $hasItemId={!!item.itemId} {...sharedProps}>
    {item.title}
  </CustomStyledNavItem>
);

const activePredicate = (item, location) =>
  (location && removeSlash(location) === removeSlash(item.itemId)) ||
  (!location && item.itemId === '/');

export default ({path}) => {
  return (
    <Navigation
      activeItemId={path}
      activePredicate={activePredicate}
      items={Routes}
      overrides={{
        NavItem: CustomNavItem,
      }}
    />
  );
};
