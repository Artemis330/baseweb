/*
Copyright (c) 2018 Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
// @flow
/* global document */
/* eslint-disable react/no-find-dom-node */
import * as React from 'react';
import ReactDOM from 'react-dom';

import Popper from 'popper.js';
import {getOverride, getOverrideProps} from '../helpers/overrides.js';
import getBuiId from '../utils/get-bui-id.js';
import {ACCESSIBILITY_TYPE, PLACEMENT, TRIGGER_TYPE} from './constants.js';
import {
  Arrow as StyledArrow,
  Body as StyledBody,
  Inner as StyledInner,
} from './styled-components.js';
import {
  toPopperPlacement,
  fromPopperPlacement,
  parsePopperOffset,
} from './utils.js';
import defaultProps from './default-props.js';

import type {
  AnchorPropsT,
  PopoverPropsT,
  PopoverPrivateStateT,
  PopperDataObjectT,
  SharedStylePropsArgT,
} from './types.js';

class Popover extends React.Component<PopoverPropsT, PopoverPrivateStateT> {
  static defaultProps: $Shape<PopoverPropsT> = defaultProps;

  /* eslint-disable react/sort-comp */
  animateInTimer: ?TimeoutID;
  animateOutTimer: ?TimeoutID;
  animateOutCompleteTimer: ?TimeoutID;
  onMouseEnterTimer: ?TimeoutID;
  onMouseLeaveTimer: ?TimeoutID;
  generatedId: string = '';
  popper: ?Popper;
  anchorRef = (React.createRef(): {current: *});
  popperRef = (React.createRef(): {current: *});
  arrowRef = (React.createRef(): {current: *});
  popperHeight = 0;
  /* eslint-enable react/sort-comp */

  /**
   * Yes our "Stateless" popover still has state. This is private state that
   * customers shouldn't have to manage themselves, such as positioning and
   * other internal flags for managing animation states.
   */
  state = this.getDefaultState(this.props);

  componentDidMount() {
    this.generatedId = getBuiId();
    this.setState({isMounted: true});
  }

  componentDidUpdate(
    prevProps: PopoverPropsT,
    prevState: PopoverPrivateStateT,
  ) {
    // Handles the case where popover content changes size and creates a gap between the anchor and
    // the popover. Popper.js only schedules updates on resize and scroll events. In the case of
    // the Select component, when options were filtered in the dropdown menu it creates a gap
    // between it and the input element.
    if (this.popperRef.current) {
      const {height} = this.popperRef.current.getBoundingClientRect();
      if (this.popperHeight !== height) {
        this.popperHeight = height;
        this.popper && this.popper.scheduleUpdate();
      }
    }

    if (
      this.props.isOpen !== prevProps.isOpen ||
      this.state.isMounted !== prevState.isMounted
    ) {
      // Transition from closed to open.
      if (this.props.isOpen) {
        // Clear any existing timers (like previous animateOutCompleteTimer)
        this.clearTimers();
        this.initializePopper();
        this.addDomEvents();
        return;
      }

      // Transition from open to closed.
      if (!this.props.isOpen && prevProps.isOpen) {
        this.destroyPopover();
        this.removeDomEvents();
        this.animateOutTimer = setTimeout(this.animateOut, 20);
        return;
      }
    }
  }

  componentWillUnmount() {
    this.destroyPopover();
    this.removeDomEvents();
    this.clearTimers();
  }

  getDefaultState(props: PopoverPropsT) {
    return {
      isAnimating: false,
      arrowOffset: {left: 0, top: 0},
      popoverOffset: {left: 0, top: 0},
      placement: props.placement,
      isMounted: false,
    };
  }

  animateIn = () => {
    if (this.props.isOpen) {
      this.setState({isAnimating: true});
    }
  };

  animateOut = () => {
    if (!this.props.isOpen) {
      this.setState({isAnimating: true});
      // Remove the popover from the DOM after animation finishes
      this.animateOutCompleteTimer = setTimeout(() => {
        this.setState({
          isAnimating: false,
          // Reset to ideal placement specified in props
          placement: this.props.placement,
        });
      }, 500);
    }
  };

  initializePopper() {
    const {placement} = this.state;
    this.popper = new Popper(this.anchorRef.current, this.popperRef.current, {
      // Recommended placement (popper may ignore if it causes a viewport overflow, etc)
      placement: toPopperPlacement(placement),
      modifiers: {
        // Passing the arrow ref will measure the arrow when calculating styles
        arrow: {
          element: this.arrowRef.current,
          enabled: this.props.showArrow,
        },
        computeStyle: {
          // Make popper use top/left instead of transform translate, this is because
          // we use transform for animations and we dont want them to conflict
          gpuAcceleration: false,
        },
        applyStyle: {
          // Disable default styling modifier, we'll apply styles on our own
          enabled: false,
        },
        applyReactStyle: {
          enabled: true,
          fn: this.onPopperUpdate,
          order: 900,
        },
        preventOverflow: {enabled: !this.props.ignoreBoundary},
      },
    });
  }

  clearTimers() {
    [
      this.animateInTimer,
      this.animateOutTimer,
      this.animateOutCompleteTimer,
      this.onMouseEnterTimer,
      this.onMouseLeaveTimer,
    ].forEach(timerId => {
      if (timerId) {
        clearTimeout(timerId);
      }
    });
  }

  onAnchorClick = (e: Event) => {
    if (this.props.onClick) {
      this.props.onClick(e);
    }
  };

  onAnchorMouseEnter = () => {
    // First clear any existing close timers, this ensures that the user can
    // move their mouse from the popover back to anchor without it hiding
    if (this.onMouseLeaveTimer) {
      clearTimeout(this.onMouseLeaveTimer);
    }

    this.triggerOnMouseEnterWithDelay();
  };

  onAnchorMouseLeave = () => {
    // Clear any existing open timer, otherwise popover could be stuck open
    if (this.onMouseEnterTimer) {
      clearTimeout(this.onMouseEnterTimer);
    }
    this.triggerOnMouseLeaveWithDelay();
  };

  onPopoverMouseEnter = () => {
    if (this.onMouseLeaveTimer) {
      clearTimeout(this.onMouseLeaveTimer);
    }
  };

  onPopoverMouseLeave = () => {
    this.triggerOnMouseLeaveWithDelay();
  };

  onKeyPress = (evt: KeyboardEvent) => {
    if (evt.key === 'Escape' && this.props.onEsc) {
      this.props.onEsc();
    }
  };

  onPopperUpdate = (data: PopperDataObjectT) => {
    const placement = fromPopperPlacement(data.placement) || PLACEMENT.top;
    this.setState({
      arrowOffset: data.offsets.arrow
        ? parsePopperOffset(data.offsets.arrow)
        : {top: 0, left: 0},
      popoverOffset: parsePopperOffset(data.offsets.popper),
      placement,
    });

    // Now that element has been positioned, we can animate it in
    this.animateInTimer = setTimeout(this.animateIn, 20);

    return data;
  };

  triggerOnMouseLeaveWithDelay() {
    const {onMouseLeaveDelay} = this.props;
    if (onMouseLeaveDelay) {
      this.onMouseLeaveTimer = setTimeout(
        this.triggerOnMouseLeave,
        onMouseLeaveDelay,
      );
      return;
    }
    this.triggerOnMouseLeave();
  }

  triggerOnMouseLeave = () => {
    if (this.props.onMouseLeave) {
      this.props.onMouseLeave();
    }
  };

  triggerOnMouseEnterWithDelay() {
    const {onMouseEnterDelay} = this.props;
    if (onMouseEnterDelay) {
      this.onMouseEnterTimer = setTimeout(
        this.triggerOnMouseEnter,
        onMouseEnterDelay,
      );
      return;
    }
    this.triggerOnMouseEnter();
  }

  triggerOnMouseEnter = () => {
    if (this.props.onMouseEnter) {
      this.props.onMouseEnter();
    }
  };

  addDomEvents() {
    if (__BROWSER__) {
      document.addEventListener('click', this.onDocumentClick);
      document.addEventListener('keyup', this.onKeyPress);
    }
  }

  removeDomEvents() {
    if (__BROWSER__) {
      document.removeEventListener('click', this.onDocumentClick);
      document.removeEventListener('keyup', this.onKeyPress);
    }
  }

  onDocumentClick = (evt: MouseEvent) => {
    const target = evt.target;
    const popper = this.popperRef.current;
    const anchor = this.anchorRef.current;
    // Ignore document click if it came from popover or anchor
    if (!popper || popper === target || popper.contains(target)) {
      return;
    }
    if (!anchor || anchor === target || anchor.contains(target)) {
      return;
    }
    if (this.props.onClickOutside) {
      this.props.onClickOutside(evt);
    }
  };

  destroyPopover() {
    if (this.popper) {
      this.popper.destroy();
      delete this.popper;
    }
    if (this.isClickTrigger()) {
      this.removeDomEvents();
    }
  }

  isClickTrigger() {
    return this.props.triggerType === TRIGGER_TYPE.click;
  }

  isHoverTrigger() {
    return this.props.triggerType === TRIGGER_TYPE.hover;
  }

  isAccessibilityTypeMenu() {
    return this.props.accessibilityType === ACCESSIBILITY_TYPE.menu;
  }

  isAccessibilityTypeTooltip() {
    return this.props.accessibilityType === ACCESSIBILITY_TYPE.tooltip;
  }

  getAnchorIdAttr() {
    const popoverId = this.getPopoverIdAttr();
    return popoverId ? `${popoverId}__anchor` : null;
  }

  getPopoverIdAttr() {
    return this.props.id || this.generatedId || null;
  }

  getAnchorProps(refKey: 'ref' | '$ref') {
    const {isOpen} = this.props;

    const anchorProps: AnchorPropsT = {
      key: 'popover-anchor',
      // Once styletron gets forwardRef support, switch to always using ref
      // https://github.com/rtsao/styletron/issues/253
      [refKey]: this.anchorRef,
    };

    const anchorId = this.getAnchorIdAttr();
    const popoverId = this.getPopoverIdAttr();
    if (this.isAccessibilityTypeMenu()) {
      anchorProps['aria-haspopup'] = 'true';
      anchorProps['aria-expanded'] = isOpen ? 'true' : 'false';
      const relationAttr = this.isClickTrigger()
        ? 'aria-controls'
        : 'aria-owns';
      anchorProps[relationAttr] = isOpen ? popoverId : null;
    } else if (this.isAccessibilityTypeTooltip()) {
      anchorProps.id = anchorId;
      anchorProps['aria-describedby'] = isOpen ? popoverId : null;
    }

    if (this.isHoverTrigger()) {
      anchorProps.onMouseEnter = this.onAnchorMouseEnter;
      anchorProps.onMouseLeave = this.onAnchorMouseLeave;

      // Make it focusable too
      anchorProps.onBlur = this.props.onBlur;
      anchorProps.onFocus = this.props.onFocus;
    } else {
      anchorProps.onClick = this.onAnchorClick;
    }
    return anchorProps;
  }

  getPopoverBodyProps() {
    const bodyProps = {};

    const popoverId = this.getPopoverIdAttr();
    if (this.isAccessibilityTypeMenu()) {
      bodyProps.id = popoverId;
    } else if (this.isAccessibilityTypeTooltip()) {
      bodyProps.id = popoverId;
      bodyProps.role = 'tooltip';
    }
    if (this.isHoverTrigger()) {
      bodyProps.onMouseEnter = this.onPopoverMouseEnter;
      bodyProps.onMouseLeave = this.onPopoverMouseLeave;
    }

    return bodyProps;
  }

  getSharedProps(): $Diff<SharedStylePropsArgT, {children?: React.Node}> {
    const {isOpen, showArrow} = this.props;
    const {isAnimating, arrowOffset, popoverOffset, placement} = this.state;
    return {
      $showArrow: Boolean(showArrow),
      $arrowOffset: arrowOffset,
      $popoverOffset: popoverOffset,
      $placement: placement,
      $isAnimating: isAnimating,
      $isOpen: isOpen,
    };
  }

  getAnchorFromChildren() {
    const {children} = this.props;
    const childArray = React.Children.toArray(children);
    if (childArray.length !== 1) {
      // eslint-disable-next-line no-console
      console.error(
        `[baseui] Exactly 1 child must be passed to Popover/Tooltip, found ${
          childArray.length
        } children`,
      );
    }
    return childArray[0];
  }

  getMountNode(): HTMLElement {
    const {mountNode} = this.props;
    if (mountNode) {
      return mountNode;
    }
    // Flow thinks body could be null (cast through any)
    // eslint-disable-next-line flowtype/no-weak-types
    return ((document.body: any): HTMLBodyElement);
  }

  renderAnchor() {
    const anchor = this.getAnchorFromChildren();
    if (!anchor) {
      return null;
    }

    const isValidElement = React.isValidElement(anchor);
    const isDomElement =
      typeof anchor === 'object' && typeof anchor.type === 'string';

    // Use $ref for complex components, ref for html elements
    const refKey = isValidElement && !isDomElement ? '$ref' : 'ref';

    const anchorProps = this.getAnchorProps(refKey);

    if (typeof anchor === 'object' && isValidElement) {
      return React.cloneElement(anchor, anchorProps);
    }
    return <span {...anchorProps}>{anchor}</span>;
  }

  renderPopover() {
    const {showArrow, overrides = {}, content} = this.props;

    const {
      Arrow: ArrowOverride,
      Body: BodyOverride,
      Inner: InnerOverride,
    } = overrides;

    const Arrow = getOverride(ArrowOverride) || StyledArrow;
    const Body = getOverride(BodyOverride) || StyledBody;
    const Inner = getOverride(InnerOverride) || StyledInner;

    const sharedProps = this.getSharedProps();
    const bodyProps = this.getPopoverBodyProps();

    return (
      <Body
        key="popover-body"
        $ref={this.popperRef}
        {...bodyProps}
        {...sharedProps}
        {...getOverrideProps(BodyOverride)}
      >
        {showArrow ? (
          <Arrow
            key="popover-arrow"
            $ref={this.arrowRef}
            {...sharedProps}
            {...getOverrideProps(ArrowOverride)}
          />
        ) : null}
        <Inner
          key="popover-inner"
          {...sharedProps}
          {...getOverrideProps(InnerOverride)}
        >
          {typeof content === 'function' ? content() : content}
        </Inner>
      </Body>
    );
  }

  render() {
    const rendered = [this.renderAnchor()];

    // Only render popover on the browser (portals aren't supported server-side)
    if (__BROWSER__) {
      if (
        this.state.isMounted &&
        (this.props.isOpen || this.state.isAnimating)
      ) {
        const mountNode = this.getMountNode();
        rendered.push(ReactDOM.createPortal(this.renderPopover(), mountNode));
      }
    }
    return rendered;
  }
}

export default Popover;
/* eslint-enable react/no-find-dom-node */
