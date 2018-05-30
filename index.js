/* @flow */

import React from 'react'
import { AppRegistry, StyleSheet, View, Plane, texture } from 'react-360'

const VncClient = () => (
  <View style={styles.panel}>
    <Plane dimWidth={1280} dimHeight={800} texture={texture('vnc_texture')} />
  </View>
)

const styles = StyleSheet.create({
  panel: {
    width: 1280,
    height: 800,
    justifyContent: 'center',
    alignItems: 'center'
  }
})

export default VncClient
AppRegistry.registerComponent('VncClient', () => VncClient)
