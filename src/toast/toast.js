/*
Copyright (c) 2018 Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
// @flow
import * as React from 'react';
import {getOverrides, mergeOverrides} from '../helpers/overrides';
import {Delete as DeleteAltIcon} from '../icon';
import {
  Body as StyledBody,
  CloseIconSvg as StyledCloseIcon,
} from './styled-components';
import {KIND} from './constants';

import type {
  ToastPropsT,
  ToastPrivateStateT,
  SharedStylePropsArgT,
} from './types';
import type {OverridesT} from '../icon';

class Toast extends React.Component<ToastPropsT, ToastPrivateStateT> {
  static defaultProps: $Shape<ToastPropsT> = {
    autoHideDuration: 0,
    closeable: true,
    kind: KIND.info,
    // Do we need a separate handler for
    // when a notification dismisses automatically
    onClose: () => {},
    onBlur: () => {},
    onFocus: () => {},
    onMouseEnter: () => {},
    onMouseLeave: () => {},
    overrides: {},
  };

  autoHideTimeout: ?TimeoutID;
  animateOutCompleteTimer: ?TimeoutID;

  state = {
    isAnimating: false,
    isHidden: true,
  };

  componentDidMount() {
    this.animateIn();
    this.startTimeout();
  }

  componentWillUnmount() {
    this.clearTimeout();
  }

  startTimeout() {
    if (this.props.autoHideDuration) {
      this.autoHideTimeout = setTimeout(
        this.dismiss,
        this.props.autoHideDuration,
      );
    }
  }

  clearTimeout() {
    [this.autoHideTimeout, this.animateOutCompleteTimer].forEach(timerId => {
      if (timerId) {
        clearTimeout(timerId);
      }
    });
  }

  animateIn = () => {
    this.setState({isHidden: false, isAnimating: true});
  };

  animateOut = (callback: () => void = () => {}) => {
    this.setState({isAnimating: true});
    // Remove the toast from the DOM after animation finishes
    this.animateOutCompleteTimer = setTimeout(() => {
      this.setState({isAnimating: false});
      callback();
    }, 600);
  };

  dismiss = () => {
    this.animateOut(this.props.onClose);
    this.setState({
      isHidden: true,
    });
  };

  onFocus = (e: Event) => {
    this.clearTimeout();
    typeof this.props.onFocus === 'function' && this.props.onFocus(e);
  };

  onMouseEnter = (e: Event) => {
    this.clearTimeout();
    typeof this.props.onMouseEnter === 'function' && this.props.onMouseEnter(e);
  };

  onBlur = (e: Event) => {
    this.startTimeout();
    typeof this.props.onBlur === 'function' && this.props.onBlur(e);
  };

  onMouseLeave = (e: Event) => {
    this.startTimeout();
    typeof this.props.onMouseLeave === 'function' && this.props.onMouseLeave(e);
  };

  getSharedProps(): $Shape<SharedStylePropsArgT> {
    const {kind, closeable} = this.props;
    const {isHidden, isAnimating} = this.state;
    return {
      $kind: kind,
      $closeable: closeable,
      $isHidden: isHidden,
      $isAnimating: isAnimating,
    };
  }

  render() {
    const {children, closeable} = this.props;
    const {isAnimating, isHidden} = this.state;
    const {
      // $FlowFixMe
      Body: BodyOverride,
      // $FlowFixMe
      CloseIcon: CloseIconOverride,
    } = this.props.overrides;

    // $FlowFixMe
    const [Body, bodyProps] = getOverrides(BodyOverride, StyledBody);

    const [CloseIcon, closeIconProps] = getOverrides(
      // $FlowFixMe
      CloseIconOverride,
      // $FlowFixMe
      StyledCloseIcon,
    );

    const closeIconOverrides: OverridesT = mergeOverrides(
      {Svg: CloseIcon},
      // $FlowFixMe
      {Svg: CloseIconOverride},
    );

    const sharedProps = this.getSharedProps();

    if (isHidden && !isAnimating) {
      return null;
    }
    return (
      <Body
        tabIndex={0}
        role="alert"
        {...sharedProps}
        {...bodyProps}
        // the properties below have to go after overrides
        onBlur={this.onBlur}
        onFocus={this.onFocus}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        {closeable ? (
          <DeleteAltIcon
            onClick={this.dismiss}
            {...sharedProps}
            {...closeIconProps}
            overrides={closeIconOverrides}
          />
        ) : null}
        {typeof children === 'function'
          ? children({dismiss: this.dismiss})
          : children}
      </Body>
    );
  }
}

export default Toast;
